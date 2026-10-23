export const dynamic = "force-dynamic"

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildTemplateContext, type ScopeDocument } from "@/lib/documents/context"
import { champsManquantsBv, messageBvIncomplet } from "@/lib/bv/verification"
import { requireApiAdmin } from "@/lib/auth/api-guards"
import { estIntervenantDeLaMission, estIntervenantDeLEtude } from "@/lib/auth/document-access"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { canEditEtude, hasPermission } from "@/lib/auth/permissions"
import {
  accesEtudeDe,
  appliquerAvenant,
  chargerAvenantsExistants,
  chargerModele,
  ouvrirCompteurs,
  persisterDocument,
} from "@/lib/documents/generation"
import { CATEGORIES_AVENANT, type ValeursAvenant } from "@/lib/documents/avenants"

// Allow up to 30 seconds for DOCX rendering
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 })

  const body = await req.json()
  const { template_id, scope, entity_id, intervenant_id, champs } = body as {
    template_id: string
    scope: ScopeDocument
    entity_id: string
    intervenant_id?: string
    /** Champs saisis pour un avenant (cf. lib/documents/avenants.ts). */
    champs?: ValeursAvenant
  }

  if (!template_id || !scope || !entity_id) {
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 })
  }
  // Le scope « personne » (ligne `personnes` brute de n'importe quel id) n'a
  // jamais eu d'appelant dans l'application : refusé.
  if (!["etude", "mission", "general", "facture"].includes(scope)) {
    return NextResponse.json({ error: "Scope inconnu" }, { status: 400 })
  }
  if (intervenant_id && typeof intervenant_id !== "string") {
    return NextResponse.json({ error: "intervenant_id invalide" }, { status: 400 })
  }
  if (intervenant_id && scope !== "etude" && scope !== "mission") {
    return NextResponse.json({ error: "intervenant_id n'est accepté que pour une étude ou une mission" }, { status: 400 })
  }

  // Modèle et profil sont indépendants : lus ensemble.
  const [{ data: tpl, error: tErr }, profile] = await Promise.all([
    sb.from("document_templates").select("*").eq("id", template_id).single(),
    getCachedProfile(user.id),
  ])
  if (tErr || !tpl) return NextResponse.json({ error: "Template introuvable" }, { status: 404 })

  // Le Bulletin de Versement embarque le NSS déchiffré de l'intervenant :
  // génération réservée aux administrateurs.
  if (tpl.category === "bulletin_versement") {
    const guard = await requireApiAdmin()
    if (!guard.ok) return guard.response
  }

  // Génération d'une facture : réservée aux profils ayant accès à la
  // Trésorerie (même permission que la page /tresorerie et les server
  // actions de lib/actions/tresorerie.ts — sans ce garde, n'importe quel
  // compte authentifié pouvait télécharger n'importe quelle facture).
  if (scope === "facture" && !hasPermission(profile, "voir_factures")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 })
  }

  // Génération de documents liés à une étude/mission : réservée au créateur
  // de l'étude, à ses suiveurs (chefs de projet), au Pôle SI et aux admins —
  // même règle que la modification de l'étude (canEditEtude).
  let etudeIdAutorise: string | null = null
  if (scope === "etude" || scope === "mission") {
    const { etudeId, acces } = await accesEtudeDe(scope, entity_id)
    if (!canEditEtude(profile, acces)) {
      return NextResponse.json(
        { error: "Seuls le créateur de l'étude, ses chefs de projet, le Pôle SI et les administrateurs peuvent générer ce document." },
        { status: 403 }
      )
    }
    etudeIdAutorise = etudeId
  }

  // Rattachement de l'intervenant, téléchargement du modèle (en mémoire après
  // la 1ʳᵉ fois) et construction du contexte : indépendants, donc lancés
  // ensemble. L'intervenant choisi doit être rattaché à la mission (ou à
  // l'étude) : sans ce contrôle, n'importe quel id de membre ressortait dans
  // le document avec ses coordonnées déchiffrées. Si le contrôle échoue, le
  // contexte déjà construit est jeté sans avoir quitté ce handler.
  const rattachement: Promise<boolean> = !intervenant_id
    ? Promise.resolve(true)
    : scope === "mission"
      ? estIntervenantDeLaMission(entity_id, intervenant_id)
      : estIntervenantDeLEtude(entity_id, intervenant_id)
  let templateBuf: Buffer
  let context: Record<string, any>
  let rattache: boolean
  try {
    ;[rattache, templateBuf, context] = await Promise.all([
      rattachement,
      chargerModele(sb, tpl.file_path, tpl.category),
      buildTemplateContext(scope, entity_id, intervenant_id, {
        includeNss: tpl.category === "bulletin_versement",
        rattachementVerifie: !!intervenant_id,
      }),
    ])
  } catch {
    return NextResponse.json({ error: "DL template" }, { status: 500 })
  }
  if (!rattache) {
    return NextResponse.json({ error: "Cet intervenant n'est pas rattaché à cette mission." }, { status: 403 })
  }

  // Un BV doit porter toutes les informations exigées par la CNJE (identité,
  // adresse et n° de sécurité sociale de l'étudiant, référence de son RDM,
  // JEH et rétribution) : incomplet, il n'est pas généré.
  if (tpl.category === "bulletin_versement") {
    const manquants = champsManquantsBv(context as any)
    if (manquants.length > 0) {
      return NextResponse.json({ error: messageBvIncomplet(manquants) }, { status: 422 })
    }
  }

  // Ne jamais journaliser le contenu du contexte : il contient des données
  // personnelles (noms, adresses, coordonnées) qui finiraient dans les logs.
  console.log("[DOC-GEN] scope:", scope, "template:", tpl.category)

  const etudeId: string | null = scope === "etude" ? entity_id : (context as any).etude?.id || etudeIdAutorise || null

  // Avenants : les passages propres à l'avenant viennent du formulaire.
  if (CATEGORIES_AVENANT.has(tpl.category as string)) {
    if (!champs || typeof champs !== "object") {
      return NextResponse.json({ error: "Renseignez les champs de l'avenant." }, { status: 422 })
    }
    const existants = await chargerAvenantsExistants(sb, tpl.category, scope, entity_id)
    const erreur = appliquerAvenant(tpl.category, context, champs, existants)
    if (erreur) return NextResponse.json({ error: erreur }, { status: 422 })
  }

  const sortie = await persisterDocument({
    sb,
    userId: user.id,
    tpl,
    templateBuf,
    scope,
    entityId: entity_id,
    context,
    // Relu à chaque tentative : un conflit d'unicité signifie qu'un autre
    // document vient de prendre ce numéro.
    compteur: async (rdmParent, tentative) => {
      const compteurs = await ouvrirCompteurs(sb, tpl, scope, entity_id, etudeId)
      return compteurs.suivant(rdmParent) + tentative
    },
  })
  if ("error" in sortie) return NextResponse.json({ error: sortie.error }, { status: sortie.status })
  return NextResponse.json({ data: sortie.data })
}
