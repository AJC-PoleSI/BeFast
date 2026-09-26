export const dynamic = "force-dynamic"

import "server-only"

import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireApiPermission } from "@/lib/auth/api-guards"
import { getBaTemplatePath, toMemberData } from "@/lib/signature/ba"
import { loadBaTemplate, fillBaPdf } from "@/lib/signature/ba-pdf"
import {
  baFileName,
  buildBaFieldValues,
  missingBaPrefillFields,
} from "@/lib/signature/ba-utils"

/**
 * Colonnes lues pour pré-remplir le BA. Pas de `*` : le NSS et l'IBAN n'ont
 * rien à faire ici, et la date de naissance n'est pas imprimée sur le BA.
 */
const COLONNES_BA = [
  "id", "email", "prenom", "nom", "portable", "promo", "etablissement",
  "scolarite", "account_status", "encryption_salt",
  "adresse", "adresse_encrypted", "adresse_iv", "adresse_auth_tag",
  "ville", "ville_encrypted", "ville_iv", "ville_auth_tag",
  "code_postal", "code_postal_encrypted", "code_postal_iv", "code_postal_auth_tag",
].join(", ")

/**
 * GET /api/profil/documents/bulletin-adhesion
 *
 * Bulletin d'adhésion de la personne connectée, pré-rempli avec son profil à
 * partir du modèle PDF à champs (Administration → Documents, catégorie
 * `bulletin_adhesion`, le même que pour la signature LiveConsent). Garde : la
 * permission `documents`, que gardent aussi les comptes pas encore validés, qui
 * doivent justement pouvoir récupérer leur BA pour le déposer signé.
 *
 * Chacun n'obtient que le sien : l'identifiant vient de la session, jamais du
 * client. Le profil est relu à chaque appel (pas le cache de 5 min), pour
 * refléter ce que la personne vient de saisir.
 *
 *  - sans paramètre : `{ available, missing }` — `missing` liste en clair les
 *    informations du profil qui manqueront sur le BA
 *  - `?download=1`  : le PDF, champs laissés modifiables
 */
export async function GET(request: Request) {
  const guard = await requireApiPermission("documents")
  if (!guard.ok) return guard.response

  const admin = createAdminClient()
  const [templatePath, { data: profile, error }] = await Promise.all([
    getBaTemplatePath(admin),
    admin.from("personnes").select(COLONNES_BA).eq("id", guard.userId).single(),
  ])

  if (error || !profile) {
    console.error("[profil/documents/bulletin-adhesion] profil:", error)
    return NextResponse.json({ error: "Profil introuvable." }, { status: 404 })
  }

  const member = toMemberData(profile)

  if (new URL(request.url).searchParams.get("download") !== "1") {
    return NextResponse.json({
      available: !!templatePath,
      missing: missingBaPrefillFields(member),
    })
  }

  if (!templatePath) {
    return NextResponse.json(
      { error: "Le bulletin d'adhésion n'est pas encore disponible. Réessayez plus tard." },
      { status: 404 }
    )
  }

  const templateBytes = await loadBaTemplate(admin, templatePath)
  if (!templateBytes) {
    return NextResponse.json(
      { error: "Téléchargement impossible pour le moment. Réessayez plus tard." },
      { status: 500 }
    )
  }

  let pdf: Uint8Array
  try {
    pdf = await fillBaPdf(templateBytes, buildBaFieldValues(member), { flatten: false })
  } catch (e) {
    console.error("[profil/documents/bulletin-adhesion] remplissage:", e)
    return NextResponse.json(
      { error: "Téléchargement impossible pour le moment. Réessayez plus tard." },
      { status: 500 }
    )
  }

  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${baFileName(member)}"`,
      // Données personnelles : ni cache partagé, ni cache navigateur.
      "Cache-Control": "private, no-store",
    },
  })
}
