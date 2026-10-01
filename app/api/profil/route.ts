export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { encryptData, generateEncryptionSalt } from "@/lib/crypto"
import { getMasterKey } from "@/lib/crypto-key"
import { CHAMPS_PII, colonnesPII, lirePII, lireSecret, type ChampPII } from "@/lib/pii/personne"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { hasPermission } from "@/lib/auth/permissions"
import { getCurrentUserProfile, logAudit } from "@/lib/supabase-security"
import { USER_PROFILE_TAG } from "@/lib/cache-tags"
import { ETABLISSEMENTS, SCOLARITES } from "@/app/(dashboard)/dashboard/profil/_lib/schemas"
import { revalidateTag } from "next/cache"
import { NextRequest, NextResponse } from "next/server"

/**
 * Permissions qui ouvrent la fiche d'un autre membre (/dashboard/profil/[userId]).
 * La fiche pré-remplit son formulaire avec les coordonnées déchiffrées d'ici :
 * elles ne sont plus en clair en base.
 */
const CLES_FICHE_MEMBRE = ["membres", "voir_documents_membres", "voir_nss", "voir_rib"] as const

export async function GET(req: NextRequest) {
  try {
    const sb = createClient()
    const { user } = await getCurrentUserProfile(sb)
    const targetUserId = new URL(req.url).searchParams.get("targetUserId") ?? user.id
    const estSoi = targetUserId === user.id

    if (!estSoi) {
      const appelant = await getCachedProfile(user.id)
      if (!CLES_FICHE_MEMBRE.some((cle) => hasPermission(appelant, cle))) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
      }
    }

    const admin = createAdminClient()
    const { data: fullProfile, error } = await admin
      .from("personnes")
      .select("*")
      .eq("id", targetUserId)
      .single()

    if (error || !fullProfile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 })

    // Pour un autre membre : ses coordonnées seulement, jamais NSS ni IBAN.
    if (!estSoi) {
      return NextResponse.json({ data: { id: fullProfile.id, ...lirePII(fullProfile) } })
    }

    // Déchiffrement tolérant, dans les deux formats du NSS/IBAN : un champ
    // illisible vaut null. Auparavant, un NSS importé de Be Quick (format
    // mono-chaîne) faisait échouer toute la réponse et le formulaire retombait
    // sur le profil en cache, dont les coordonnées ne sont plus en clair.
    return NextResponse.json({
      data: {
        ...fullProfile,
        nss: lireSecret(fullProfile, "nss"),
        iban: lireSecret(fullProfile, "iban"),
        ...lirePII(fullProfile),
      },
    })
  } catch (error: any) {
    console.error("[GET /api/profil]", error.message)
    return NextResponse.json({ error: error.message }, { status: error.status || 401 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const sb = createClient()
    const { data: { user }, error: authError } = await sb.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

    const body = await req.json()
    const MASTER_KEY = getMasterKey()
    const admin = createAdminClient()

    const { data: profile } = await admin
      .from("personnes")
      .select("encryption_salt")
      .eq("id", user.id)
      .single()

    const salt = profile?.encryption_salt || generateEncryptionSalt()

    const updates: any = { encryption_salt: salt }

    if (body.nss) {
      const enc = encryptData(body.nss, MASTER_KEY, salt)
      updates.nss_encrypted = enc.encrypted
      updates.nss_iv = enc.iv
      updates.nss_auth_tag = enc.authTag
    }
    if (body.iban) {
      const enc = encryptData(body.iban, MASTER_KEY, salt)
      updates.iban_encrypted = enc.encrypted
      updates.iban_iv = enc.iv
      updates.iban_auth_tag = enc.authTag
    }
    // Champ renseigné : écrit chiffré, colonne en clair vidée.
    const pii: Partial<Record<ChampPII, string>> = {}
    for (const field of CHAMPS_PII) {
      if (body[field]) pii[field] = body[field]
    }
    Object.assign(updates, colonnesPII(pii, salt))

    const { data: updated, error } = await admin
      .from("personnes")
      .update(updates)
      .eq("id", user.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ data: updated })
  } catch (error: any) {
    console.error("[PUT /api/profil]", error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const sb = createClient()
    const { user, profile } = await getCurrentUserProfile(sb)
    const userRole = (profile.profils_types as any)?.slug

    const body = await req.json()
    const { searchParams } = new URL(req.url)
    const targetUserId = searchParams.get("targetUserId") ?? user.id
    const isAdmin = userRole === "administrateur"

    // Seul un administrateur peut modifier le profil d'un AUTRE utilisateur.
    if (targetUserId !== user.id && !isAdmin) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
    }

    // Champs en libre-service (modifiables par l'utilisateur sur son propre profil).
    // Cette liste DOIT rester alignée sur les champs du formulaire de profil
    // (`ProfileFormValues`) : un champ envoyé mais absent d'ici est simplement
    // ignoré côté serveur, et l'utilisateur voit sa saisie disparaître au
    // rechargement sans le moindre message d'erreur.
    const ALLOWED = [
      "prenom", "nom", "portable", "promo", "adresse", "ville", "code_postal",
      "etablissement", "scolarite", "date_naissance",
    ] as const
    const updates: Record<string, string | null> = {}

    for (const field of ALLOWED) {
      if (body[field] !== undefined) updates[field] = body[field] || null
    }

    // Valeurs contraintes en base : on rejette explicitement plutôt que de
    // laisser Postgres renvoyer une erreur de contrainte illisible.
    if (updates.etablissement && !ETABLISSEMENTS.includes(updates.etablissement as any)) {
      return NextResponse.json({ error: "Établissement invalide" }, { status: 400 })
    }
    if (updates.scolarite && !SCOLARITES.includes(updates.scolarite as any)) {
      return NextResponse.json({ error: "Niveau de scolarité invalide" }, { status: 400 })
    }
    if (updates.date_naissance && !/^\d{4}-\d{2}-\d{2}$/.test(updates.date_naissance)) {
      return NextResponse.json({ error: "Date de naissance invalide (AAAA-MM-JJ)" }, { status: 400 })
    }

    // Le pôle pilote les permissions : seul un administrateur peut l'attribuer.
    // Le formulaire renvoie toujours `pole` (y compris pour un non-admin, qui le
    // voit en lecture seule) → on l'ignore silencieusement au lieu de renvoyer
    // un 403 qui bloquerait toute modification de profil.
    if (isAdmin && body.pole !== undefined) {
      updates.pole = body.pole || null
    }

    // Champs jamais modifiables via cette route, même par un administrateur :
    // ils ont leurs propres routes dédiées (validation de compte, gestion des
    // rôles) avec leurs contrôles et leurs notifications.
    const FORBIDDEN_FIELDS = ["profil_type_id", "account_status", "is_candidate", "reset_token_hash"]
    for (const field of FORBIDDEN_FIELDS) {
      if (body[field] !== undefined) {
        return NextResponse.json(
          { error: `Champ non modifiable ici : ${field}` },
          { status: 403 }
        )
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Aucun champ modifiable fourni" }, { status: 400 })
    }

    // --- Chiffrement côté serveur pour les champs sensibles ---
    // Le GET lit les colonnes *_encrypted : une valeur écrite uniquement en
    // clair ne serait pas relue (et ne doit de toute façon plus l'être).
    const admin = createAdminClient()

    const { data: existingProfile } = await admin
      .from("personnes")
      .select("encryption_salt")
      .eq("id", targetUserId)
      .single()

    const salt = existingProfile?.encryption_salt || generateEncryptionSalt()
    if (!existingProfile?.encryption_salt) {
      updates.encryption_salt = salt
    }

    // Les données personnelles ne sont écrites que chiffrées : la colonne en
    // clair du même nom est vidée (elle recevait jusqu'ici une copie lisible).
    const pii: Partial<Record<ChampPII, string | null>> = {}
    for (const field of CHAMPS_PII) {
      if (field in updates) pii[field] = updates[field]
    }
    Object.assign(updates, colonnesPII(pii, salt))

    const { data: updated, error } = await admin
      .from("personnes")
      .update(updates)
      .eq("id", targetUserId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Le profil est servi depuis un cache de 5 min (`getCachedProfile`) : sans
    // invalidation, la modification n'apparaît nulle part avant expiration —
    // symptôme identique à une sauvegarde qui échoue.
    revalidateTag(USER_PROFILE_TAG(targetUserId))

    // Log profile updates
    await logAudit(sb, 'personnes', 'UPDATE', targetUserId, { fields: Object.keys(updates) })

    // Retourner le profil avec les champs décryptés pour que le frontend
    // puisse mettre à jour son état immédiatement sans re-fetch.
    return NextResponse.json({ data: { ...updated, ...lirePII(updated) } })
  } catch (error: any) {
    console.error("[PATCH /api/profil]", error.message)
    return NextResponse.json({ error: error.message }, { status: error.status || 500 })
  }
}
