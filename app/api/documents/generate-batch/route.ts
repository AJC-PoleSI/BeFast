export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildMissionContexts } from "@/lib/documents/context"
import { champsManquantsBv, messageBvIncomplet } from "@/lib/bv/verification"
import { requireApiAdmin } from "@/lib/auth/api-guards"
import { intervenantsDeLaMission } from "@/lib/auth/document-access"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { canEditEtude } from "@/lib/auth/permissions"
import {
  accesEtudeDe,
  appliquerAvenant,
  chargerAvenantsExistants,
  chargerModele,
  ouvrirCompteurs,
  persisterDocument,
} from "@/lib/documents/generation"
import { CATEGORIES_AVENANT, validerChampsAvenant, type ValeursAvenant } from "@/lib/documents/avenants"
import { CATEGORIES_PAR_INTERVENANT } from "@/lib/documents/nomenclature"
import { segmentRdmParent } from "@/lib/document-numbering"

export const maxDuration = 60

/** Au-delà, l'appelant découpe (l'interface envoie des lots de 6). */
const MAX_PAR_LOT = 10
/** Rendus/envois simultanés : assez pour gagner du temps, sans saturer le stockage. */
const CONCURRENCE = 4

type Resultat =
  | { intervenant_id: string; ok: true; data: any }
  | { intervenant_id: string; ok: false; error: string }

/**
 * Génère le même document pour plusieurs intervenants d'une mission (26 avenants
 * au RDM, 26 RDM…) : un document par intervenant, numérotés à la suite.
 * Les données communes de la mission sont chargées une seule fois.
 */
export async function POST(req: NextRequest) {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = await req.json()
  const { template_id, mission_id, intervenant_ids, champs } = body as {
    template_id: string
    mission_id: string
    intervenant_ids: string[]
    /** Champs saisis pour un avenant, communs à tous les intervenants du lot. */
    champs?: ValeursAvenant
  }
  if (!template_id || !mission_id || !Array.isArray(intervenant_ids) || intervenant_ids.length === 0) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })
  }
  if (intervenant_ids.length > MAX_PAR_LOT || intervenant_ids.some((i) => typeof i !== "string")) {
    return NextResponse.json({ error: `${MAX_PAR_LOT} intervenants au maximum par lot` }, { status: 400 })
  }
  const ids = Array.from(new Set(intervenant_ids))

  const [{ data: tpl, error: tErr }, profile] = await Promise.all([
    sb.from("document_templates").select("*").eq("id", template_id).single(),
    getCachedProfile(user.id),
  ])
  if (tErr || !tpl) return NextResponse.json({ error: "Template introuvable" }, { status: 404 })

  // Un document par personne : seuls les modèles « intervenant » s'y prêtent.
  if (!CATEGORIES_PAR_INTERVENANT.has(tpl.category as string)) {
    return NextResponse.json({ error: "Ce modèle ne se génère pas par intervenant." }, { status: 400 })
  }
  // Le Bulletin de Versement embarque le NSS déchiffré : administrateurs seulement.
  if (tpl.category === "bulletin_versement") {
    const guard = await requireApiAdmin()
    if (!guard.ok) return guard.response
  }

  // Même règle que la génération unitaire : créateur de l'étude, suiveurs, Pôle SI, admins.
  const [{ etudeId, acces }, rattaches] = await Promise.all([
    accesEtudeDe("mission", mission_id),
    intervenantsDeLaMission(mission_id),
  ])
  if (!canEditEtude(profile, acces)) {
    return NextResponse.json(
      { error: "Seuls le créateur de l'étude, ses chefs de projet, le Pôle SI et les administrateurs peuvent générer ce document." },
      { status: 403 }
    )
  }
  const horsMission = ids.filter((i) => !rattaches.has(i))
  if (horsMission.length > 0) {
    return NextResponse.json({ error: "Un intervenant sélectionné n'est pas rattaché à cette mission." }, { status: 403 })
  }

  let templateBuf: Buffer
  let contextes: Awaited<ReturnType<typeof buildMissionContexts>>
  let compteurs: Awaited<ReturnType<typeof ouvrirCompteurs>>
  try {
    ;[templateBuf, contextes, compteurs] = await Promise.all([
      chargerModele(sb, tpl.file_path, tpl.category),
      buildMissionContexts(mission_id, ids, { includeNss: tpl.category === "bulletin_versement" }),
      ouvrirCompteurs(sb, tpl, "mission", mission_id, etudeId),
    ])
  } catch {
    return NextResponse.json({ error: "DL template" }, { status: 500 })
  }

  console.log("[DOC-GEN] batch template:", tpl.category, "documents:", ids.length)

  // Avenants : champs saisis (communs au lot) + avenants déjà générés pour
  // chaque RDM. Un intervenant sans RDM n'a pas d'avenant possible. Contrôles
  // faits AVANT l'attribution des numéros : un échec ne laisse pas de trou.
  const estAvenant = CATEGORIES_AVENANT.has(tpl.category as string)
  if (estAvenant && (!champs || typeof champs !== "object")) {
    return NextResponse.json({ error: "Renseignez les champs de l'avenant." }, { status: 422 })
  }
  if (estAvenant) {
    const erreurs = validerChampsAvenant(tpl.category, champs!)
    if (erreurs.length > 0) return NextResponse.json({ error: erreurs.join(" ") }, { status: 422 })
  }
  const existants = estAvenant ? await chargerAvenantsExistants(sb, tpl.category, "mission", mission_id) : []
  const aFaire = contextes.map(({ intervenantId, context }) => ({
    intervenantId,
    context,
    rdmParent: segmentRdmParent((context as any).mission?.reference_recap_mission),
  }))
  const erreursPrealables = aFaire.map((d) =>
    estAvenant ? appliquerAvenant(tpl.category, d.context, champs!, existants) : null
  )

  // Numéros attribués d'avance, dans l'ordre demandé : les rendus parallèles
  // ne se disputent pas le même compteur.
  const departs = aFaire.map((d, i) => (erreursPrealables[i] ? 0 : compteurs.suivant(d.rdmParent)))

  const resultats: Resultat[] = new Array(aFaire.length)
  let curseur = 0
  async function travailleur() {
    while (curseur < aFaire.length) {
      const i = curseur++
      const { intervenantId, context } = aFaire[i]

      if (erreursPrealables[i]) {
        resultats[i] = { intervenant_id: intervenantId, ok: false, error: erreursPrealables[i]! }
        continue
      }
      if (tpl.category === "bulletin_versement") {
        const manquants = champsManquantsBv(context as any)
        if (manquants.length > 0) {
          resultats[i] = { intervenant_id: intervenantId, ok: false, error: messageBvIncomplet(manquants) }
          continue
        }
      }
      const sortie = await persisterDocument({
        sb,
        userId: user!.id,
        tpl,
        templateBuf,
        scope: "mission",
        entityId: mission_id,
        context,
        compteur: async (_parent, tentative) => departs[i] + tentative,
      })
      resultats[i] =
        "error" in sortie
          ? { intervenant_id: intervenantId, ok: false, error: sortie.error }
          : { intervenant_id: intervenantId, ok: true, data: sortie.data }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCE, aFaire.length) }, travailleur))

  return NextResponse.json({ resultats })
}
