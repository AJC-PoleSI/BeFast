export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { encryptData, decryptData, generateEncryptionSalt } from "@/lib/crypto"
import { getMasterKey } from "@/lib/crypto-key"
import { getCurrentUserProfile, requireRole, logAudit } from "@/lib/supabase-security"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const sb = createClient()
    const { user, profile } = await getCurrentUserProfile(sb)

    const MASTER_KEY = getMasterKey()
    const admin = createAdminClient()
    const { data: fullProfile, error } = await admin
      .from("personnes")
      .select("*")
      .eq("id", user.id)
      .single()

    if (error || !fullProfile) return NextResponse.json({ error: "Profil introuvable" }, { status: 404 })

    const salt = fullProfile.encryption_salt || generateEncryptionSalt()

    const decrypted = {
      ...fullProfile,
      nss: fullProfile.nss_encrypted ? decryptData(fullProfile.nss_encrypted, fullProfile.nss_iv, fullProfile.nss_auth_tag, MASTER_KEY, salt) : null,
      iban: fullProfile.iban_encrypted ? decryptData(fullProfile.iban_encrypted, fullProfile.iban_iv, fullProfile.iban_auth_tag, MASTER_KEY, salt) : null,
      adresse: fullProfile.adresse_encrypted ? decryptData(fullProfile.adresse_encrypted, fullProfile.adresse_iv, fullProfile.adresse_auth_tag, MASTER_KEY, salt) : fullProfile.adresse,
      date_naissance: fullProfile.date_naissance_encrypted ? decryptData(fullProfile.date_naissance_encrypted, fullProfile.date_naissance_iv, fullProfile.date_naissance_auth_tag, MASTER_KEY, salt) : fullProfile.date_naissance,
      ville: fullProfile.ville_encrypted ? decryptData(fullProfile.ville_encrypted, fullProfile.ville_iv, fullProfile.ville_auth_tag, MASTER_KEY, salt) : fullProfile.ville,
      code_postal: fullProfile.code_postal_encrypted ? decryptData(fullProfile.code_postal_encrypted, fullProfile.code_postal_iv, fullProfile.code_postal_auth_tag, MASTER_KEY, salt) : fullProfile.code_postal,
    }

    // Log access to sensitive profile data
    await logAudit(sb, 'personnes', 'SELECT', user.id)

    return NextResponse.json({ data: decrypted })
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
    if (body.adresse) {
      const enc = encryptData(body.adresse, MASTER_KEY, salt)
      updates.adresse_encrypted = enc.encrypted
      updates.adresse_iv = enc.iv
      updates.adresse_auth_tag = enc.authTag
    }
    if (body.date_naissance) {
      const enc = encryptData(body.date_naissance, MASTER_KEY, salt)
      updates.date_naissance_encrypted = enc.encrypted
      updates.date_naissance_iv = enc.iv
      updates.date_naissance_auth_tag = enc.authTag
    }
    if (body.ville) {
      const enc = encryptData(body.ville, MASTER_KEY, salt)
      updates.ville_encrypted = enc.encrypted
      updates.ville_iv = enc.iv
      updates.ville_auth_tag = enc.authTag
    }
    if (body.code_postal) {
      const enc = encryptData(body.code_postal, MASTER_KEY, salt)
      updates.code_postal_encrypted = enc.encrypted
      updates.code_postal_iv = enc.iv
      updates.code_postal_auth_tag = enc.authTag
    }

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
    const ALLOWED = ["prenom", "nom", "portable", "promo", "adresse", "ville", "code_postal"] as const
    const updates: Record<string, string | null> = {}

    for (const field of ALLOWED) {
      if (body[field] !== undefined) updates[field] = body[field] || null
    }

    // Forbidden fields for non-admins (protected by migration 035 trigger)
    const FORBIDDEN_FIELDS = ["taux_horaire", "poles", "profil_type_id", "account_status", "email_verified"]
    for (const field of FORBIDDEN_FIELDS) {
      if (body[field] !== undefined && !isAdmin) {
        return NextResponse.json(
          { error: `Unauthorized: cannot modify ${field}` },
          { status: 403 }
        )
      }
      if (body[field] !== undefined && isAdmin) {
        updates[field] = body[field]
      }
    }

    // Le pôle pilote les permissions : seul un administrateur peut l'attribuer
    if (isAdmin && body.poles !== undefined) {
      updates.poles = body.poles || null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "Aucun champ modifiable fourni" }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: updated, error } = await admin
      .from("personnes")
      .update(updates)
      .eq("id", targetUserId)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Log profile updates
    await logAudit(sb, 'personnes', 'UPDATE', targetUserId, { fields: Object.keys(updates) })

    return NextResponse.json({ data: updated })
  } catch (error: any) {
    console.error("[PATCH /api/profil]", error.message)
    return NextResponse.json({ error: error.message }, { status: error.status || 500 })
  }
}
