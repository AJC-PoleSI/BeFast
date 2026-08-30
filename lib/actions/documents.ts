"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath, revalidateTag, unstable_cache, unstable_noStore as noStore } from "next/cache"
import { decryptData } from "@/lib/crypto"
import { getMasterKey } from "@/lib/crypto-key"
import { decryptFromString } from "@/lib/encryption"

const TEMPLATES_TAG = "document_templates"

// Uses admin client (no cookies) so unstable_cache works across requests.
// Templates are global admin resources — bypassing RLS is safe here.
const _listTemplatesCached = unstable_cache(
  async () => {
    const sb = createAdminClient()
    const { data, error } = await sb
      .from("document_templates")
      .select("id, name, description, category, file_path, file_name, placeholders, created_at")
      .order("created_at", { ascending: false })
    if (error) return { error: error.message }
    return { data }
  },
  [TEMPLATES_TAG],
  { tags: [TEMPLATES_TAG], revalidate: 3600 }
)

export async function listTemplates() {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  return _listTemplatesCached()
}

export async function deleteTemplate(id: string) {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data: tpl } = await sb
    .from("document_templates")
    .select("file_path")
    .eq("id", id)
    .single()
  if (tpl?.file_path) {
    await sb.storage.from("templates").remove([tpl.file_path])
  }
  const { error } = await sb.from("document_templates").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidateTag(TEMPLATES_TAG)
  revalidatePath("/administration/documents")
  return { success: true }
}

export async function updateTemplateMeta(
  id: string,
  updates: Partial<{ name: string; description: string; category: string }>
) {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { error } = await sb.from("document_templates").update(updates).eq("id", id)
  if (error) return { error: error.message }
  revalidateTag(TEMPLATES_TAG)
  revalidatePath("/administration/documents")
  return { success: true }
}

export async function listEntityDocuments(scope: string, entityId: string) {
  noStore()
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data, error } = await sb
    .from("generated_documents")
    .select("*, document_templates(id, name)")
    .eq("scope", scope)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false })
  if (error) return { error: error.message }
  return { data }
}

/**
 * List all documents related to an étude:
 * - documents directly scoped to the étude
 * - documents scoped to missions belonging to this étude
 */
export async function listEtudeAllDocuments(etudeId: string) {
  noStore()
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  // Get mission IDs for this étude
  const { data: missions } = await sb
    .from("missions")
    .select("id")
    .eq("etude_id", etudeId)
  const missionIds = (missions || []).map((m: any) => m.id)

  // Fetch étude-scoped + mission-scoped docs in parallel
  const queries: any[] = [
    sb
      .from("generated_documents")
      .select("*, document_templates(id, name)")
      .eq("scope", "etude")
      .eq("entity_id", etudeId)
      .then((r: any) => r),
  ]
  if (missionIds.length > 0) {
    queries.push(
      sb
        .from("generated_documents")
        .select("*, document_templates(id, name)")
        .eq("scope", "mission")
        .in("entity_id", missionIds)
        .then((r: any) => r)
    )
  }

  const results = await Promise.all(queries)
  const all: any[] = []
  for (const r of results) {
    if (r.data) all.push(...r.data)
  }
  all.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""))
  return { data: all }
}

export async function deleteGeneratedDocument(id: string) {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data: doc } = await sb
    .from("generated_documents")
    .select("file_path, scope, entity_id")
    .eq("id", id)
    .single()
  if (doc?.file_path) {
    await sb.storage.from("documents").remove([doc.file_path])
  }
  const { error } = await sb.from("generated_documents").delete().eq("id", id)
  if (error) return { error: error.message }
  if (doc) {
    revalidatePath(`/${doc.scope === "mission" ? "missions" : "etudes"}/${doc.entity_id}/documents`)
  }
  return { success: true }
}

/**
 * List missions for an étude (for the mission/intervenant selector on étude documents page).
 */
export async function listEtudeMissions(etudeId: string) {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data, error } = await sb
    .from("missions")
    .select("id, nom, type, statut, intervenant_id, intervenant:personnes!missions_intervenant_id_fkey(id, prenom, nom)")
    .eq("etude_id", etudeId)
    .order("created_at", { ascending: true })
  if (error) return { error: error.message, data: [] }
  return { data: data || [] }
}

/**
 * List intervenants for a mission.
 * Combines: accepted candidatures + directly assigned intervenant (missions.intervenant_id).
 */
export async function listMissionIntervenants(missionId: string) {
  const sb = createClient()
  const {
    data: { user },
  } = await sb.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const [candidaturesRes, missionRes] = await Promise.all([
    sb
      .from("candidatures")
      .select("personne_id, personnes!candidatures_personne_id_fkey(id, prenom, nom, email)")
      .eq("mission_id", missionId)
      .eq("statut", "acceptee"),
    sb
      .from("missions")
      .select("intervenant_id, intervenant:personnes!missions_intervenant_id_fkey(id, prenom, nom, email)")
      .eq("id", missionId)
      .single(),
  ])

  const seen = new Set<string>()
  const intervenants: any[] = []

  for (const c of candidaturesRes.data || []) {
    const p = (c as any).personnes
    if (p && !seen.has(p.id)) {
      seen.add(p.id)
      intervenants.push(p)
    }
  }

  const directIntervenant = (missionRes.data as any)?.intervenant
  if (directIntervenant && !seen.has(directIntervenant.id)) {
    intervenants.push(directIntervenant)
  }

  return { data: intervenants }
}

// ============================================================
// Helper: load all structure parameters from the parametres table
// ============================================================
async function loadStructureParams(sb: ReturnType<typeof createAdminClient>) {
  const { data, error } = await sb.from("parametres").select("key, value")
  const params: Record<string, string> = {}
  if (data) {
    for (const row of data) {
      params[row.key] = row.value || ""
    }
  }
  return params
}

// ============================================================
// Helper: format a date to DD/MM/YYYY
// ============================================================
function formatDateFR(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0")
  const mm = String(date.getMonth() + 1).padStart(2, "0")
  const yyyy = String(date.getFullYear())
  return `${dd}/${mm}/${yyyy}`
}

// Format an ISO date string (YYYY-MM-DD) or Date into DD/MM/YYYY.
// Returns "" for null/undefined/empty/invalid inputs.
function fmtDate(value: any): string {
  if (!value) return ""
  const d = value instanceof Date ? value : new Date(value)
  if (isNaN(d.getTime())) return ""
  return formatDateFR(d)
}

// Construit le tableau de phases + le nombre total de JEH + une table XML de planning.
// Fonction pure (réutilisée par buildTemplateContext et buildFactureContext).
function buildPhasesContext(blocs: any[] | undefined) {
  if (!blocs || !Array.isArray(blocs)) return { phases: [], nb_jeh: 0, nb_phases: 0, planning: "" }

  const sortedBlocs = [...blocs].sort((a, b) => (a.ordre || 0) - (b.ordre || 0) || a.semaine_debut - b.semaine_debut)

  let totalJeh = 0
  const phases = sortedBlocs.map((b, i) => {
    const jeh = Number(b.nombre_jeh) || Number(b.jeh) || 0
    totalJeh += jeh
    return {
      numero: i + 1,
      lettre: String.fromCharCode(65 + i),
      nom: b.nom || "",
      description: b.description || "",
      prix_jeh: Number(b.prix_jeh) || 0,
      nombre_jeh: jeh,
      montant_ht: (Number(b.prix_jeh) || 0) * jeh,
      semaine_debut: b.semaine_debut,
      semaine_fin: b.semaine_debut + (b.duree_semaines || 1) - 1,
    }
  })

  let rowsXml = ""
  for (const p of phases) {
    rowsXml += `
      <w:tr>
        <w:tc><w:p><w:r><w:t>${p.numero} - ${p.nom}</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>S${p.semaine_debut} à S${p.semaine_fin}</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:r><w:t>${p.nombre_jeh} JEH</w:t></w:r></w:p></w:tc>
      </w:tr>
    `
  }
  const planning = `
    <w:tbl>
      <w:tblPr>
        <w:tblStyle w:val="TableGrid"/>
        <w:tblW w:w="5000" w:type="pct"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        </w:tblBorders>
      </w:tblPr>
      ${rowsXml}
    </w:tbl>
  `

  return { phases, nb_jeh: totalJeh, nb_phases: phases.length, planning }
}

// Alias {junior.*} → paramètres structure, avec les noms de champs utilisés par les
// templates historiques (Bulletin de Versement, Facture) : adresse1/2, n_urssaf,
// n_tva_intra, banque_*, nom, raison_sociale…
function buildJuniorAlias(params: Record<string, string>) {
  return {
    nom: params.raison_sociale || "",
    raison_sociale: params.raison_sociale || "",
    // La page Paramètres édite ces valeurs sous les clés historiques
    // (statuts_juridiques, rib, domiciliation, ordre_paiements) — on les
    // privilégie, avec repli sur les clés seedées par la migration 046.
    statut_juridique: params.statuts_juridiques || params.statut_juridique || "",
    adresse1: params.adresse_1 || "",
    adresse2: params.adresse_2 || "",
    adresse: [params.adresse_1, params.adresse_2].filter(Boolean).join(", "),
    code_postal: params.code_postal || "",
    ville: params.ville || "",
    siret: params.siret || "",
    code_ape: params.code_ape || "",
    n_urssaf: params.numero_urssaf || "",
    n_tva_intra: params.numero_tva || "",
    nom_ecole: params.nom_ecole || "",
    telephone: params.telephone || "",
    email: params.email_contact || "",
    site_web: params.site_web || "",
    banque_rib: params.rib || params.banque_rib || "",
    banque_domiciliation: params.domiciliation || params.banque_domiciliation || "",
    banque_iban: params.iban || "",
    banque_bic: params.bic || "",
    ordre_cheques: params.ordre_paiements || params.ordre_cheques || "",
  }
}

// Build president/tresorier/structure objects from parametres. Fonction pure (réutilisée).
function buildOrganigramme(params: Record<string, string>) {
  // Parse president_nom which may be "Prénom Nom" or just "Nom"
  const presidentNomRaw = params.president_nom || ""
  const presidentParts = presidentNomRaw.trim().split(/\s+/).filter(Boolean)
  const presidentGenre = params.president_genre || "M"

  const tresorierNomRaw = params.tresorier_nom || ""
  const tresorierParts = tresorierNomRaw.trim().split(/\s+/).filter(Boolean)
  const tresorierGenre = params.tresorier_genre || "M"

  return {
    president: {
      nom: presidentParts.length > 1 ? presidentParts.slice(1).join(" ") : presidentParts[0] || "",
      prenom: presidentParts.length > 1 ? presidentParts[0] : "",
      nom_complet: presidentNomRaw,
      genre: presidentGenre,
      civilite: presidentGenre === "F" ? "Madame" : "Monsieur",
      titre: presidentGenre === "F" ? "Madame" : "Monsieur",
    },
    tresorier: {
      nom: tresorierParts.length > 1 ? tresorierParts.slice(1).join(" ") : tresorierParts[0] || "",
      prenom: tresorierParts.length > 1 ? tresorierParts[0] : "",
      nom_complet: tresorierNomRaw,
      genre: tresorierGenre,
      civilite: tresorierGenre === "F" ? "Madame" : "Monsieur",
      titre: tresorierGenre === "F" ? "Madame" : "Monsieur",
    },
    structure: {
      raison_sociale: params.raison_sociale || "",
      siret: params.siret || "",
      code_ape: params.code_ape || "",
      numero_tva: params.numero_tva || "",
      numero_urssaf: params.numero_urssaf || "",
      adresse: [params.adresse_1, params.adresse_2].filter(Boolean).join(", "),
      adresse_1: params.adresse_1 || "",
      adresse_2: params.adresse_2 || "",
      code_postal: params.code_postal || "",
      ville: params.ville || "",
      telephone: params.telephone || "",
      email: params.email_contact || "",
      site_web: params.site_web || "",
      iban: params.iban || "",
      bic: params.bic || "",
      nom_ecole: params.nom_ecole || "",
      statut_juridique: params.statuts_juridiques || params.statut_juridique || "",
      banque_rib: params.rib || params.banque_rib || "",
      banque_domiciliation: params.domiciliation || params.banque_domiciliation || "",
      ordre_cheques: params.ordre_paiements || params.ordre_cheques || "",
      tva_taux: params.tva_rate || params.tva_taux || "",
    },
    junior: buildJuniorAlias(params),
  }
}

// Nombre de jours calendaires entre deux dates (fallback 0 si dates invalides/absentes)
function computeDureeJours(dateDebut: any, dateFin: any): number {
  if (!dateDebut || !dateFin) return 0
  const d1 = new Date(dateDebut)
  const d2 = new Date(dateFin)
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)))
}

// Format décimal français : 1234.5 → "1234,50"
function fmtDec(n: number, decimals = 2): string {
  return (Number(n) || 0).toFixed(decimals).replace(".", ",")
}

/**
 * Contexte {bv.*} du Bulletin de Versement : tableau des cotisations URSSAF.
 * Tous les taux viennent de la table parametres (clés bv_*, remplies par le
 * trésorier avec les taux officiels de l'année). Les cellules sont préformatées
 * en chaînes (virgule décimale, vide si taux = 0) — le template n'a plus aucun calcul.
 */
function buildBvContext(params: Record<string, string>, nbJeh: number, retributionBrute: number) {
  const num = (k: string) => Number(params[k]) || 0
  const baseUrssaf = num("bv_base_urssaf")
  const assiette = nbJeh * baseUrssaf
  const csgBase = retributionBrute * ((num("bv_csg_assiette_pct") || 98.25) / 100)

  // slug → [libellé, assiette de calcul]. AC (chômage, supprimée) sert
  // uniquement à la ligne "évolution de la rétribution" du modèle CNJE.
  const ROWS: [string, string, number][] = [
    ["am", "Assurance Maladie", assiette],
    ["at", "ACCIDENT DU TRAVAIL", assiette],
    ["avp", "Assurance Vieillesse plafonnée", assiette],
    ["avd", "Assurance Vieillesse déplafonnée", assiette],
    ["af", "ALLOCATIONS FAMILIALES", assiette],
    ["autre", "Autres contributions", assiette],
    ["csg", "CSG déductible", csgBase],
    ["crdscsg", "CSG/CRDS non déductible", csgBase],
  ]

  const bv: Record<string, any> = {
    base_urssaf: fmtDec(baseUrssaf),
    assiette: fmtDec(assiette),
    retribution_brute: fmtDec(retributionBrute),
    retribution_par_jeh: fmtDec(nbJeh > 0 ? retributionBrute / nbJeh : 0),
  }

  let totalJuniorUrssaf = 0, totalEtudiantUrssaf = 0, totalTauxEtudiantUrssaf = 0
  let totalJuniorBrute = 0, totalEtudiantBrute = 0

  for (const [slug, nom, base] of ROWS) {
    const tauxJunior = num(`bv_${slug}_taux_junior`)
    const tauxEtudiant = num(`bv_${slug}_taux_etudiant`)
    const montantJunior = (base * tauxJunior) / 100
    const montantEtudiant = (base * tauxEtudiant) / 100

    bv[`${slug}_nom`] = nom
    bv[`${slug}_base`] = fmtDec(base)
    bv[`${slug}_junior_montant`] = tauxJunior > 0 ? fmtDec(montantJunior) : ""
    bv[`${slug}_etudiant_taux`] = tauxEtudiant > 0 ? fmtDec(tauxEtudiant) : ""
    bv[`${slug}_etudiant_pct`] = tauxEtudiant > 0 ? "%" : ""
    bv[`${slug}_etudiant_montant`] = tauxEtudiant > 0 ? fmtDec(montantEtudiant) : ""

    if (slug === "csg" || slug === "crdscsg") {
      totalJuniorBrute += montantJunior
      totalEtudiantBrute += montantEtudiant
    } else {
      totalJuniorUrssaf += montantJunior
      totalEtudiantUrssaf += montantEtudiant
      totalTauxEtudiantUrssaf += tauxEtudiant
    }
  }

  const totalEtudiant = totalEtudiantUrssaf + totalEtudiantBrute
  // CSG/CRDS non déductible réintégrée dans le net imposable
  const nonDeductible = (csgBase * num("bv_crdscsg_taux_etudiant")) / 100
  // Coefficients de la ligne "évolution liée à la suppression des cotisations
  // chômage et maladie" repris tels quels du modèle CNJE (AC = base assiette).
  const evolution = assiette * 0.0075 + assiette * 0.0145 - csgBase * 0.017 + assiette * 0.0095

  bv.total_junior_urssaf = fmtDec(totalJuniorUrssaf)
  bv.total_etudiant_taux_urssaf = fmtDec(totalTauxEtudiantUrssaf)
  bv.total_etudiant_urssaf = fmtDec(totalEtudiantUrssaf)
  bv.total_junior = fmtDec(totalJuniorUrssaf + totalJuniorBrute)
  bv.total_etudiant = fmtDec(totalEtudiant)
  bv.total_cotisations = fmtDec(totalJuniorUrssaf + totalJuniorBrute + totalEtudiant)
  bv.net_paye = fmtDec(retributionBrute - totalEtudiant)
  bv.net_imposable = fmtDec(retributionBrute - totalEtudiant + nonDeductible)
  bv.evolution_suppression = fmtDec(evolution)

  return bv
}

// "modifiée par l'avenant X" si un avenant existe, sinon chaîne vide.
// Remplace les ternaires non supportés dans les templates PVRI/PVRF/Facture.
function buildMentionAvenant(etude: any): string {
  const ref = etude?.reference_dernier_avenant
  if (!ref || String(ref).trim() === "" || String(ref) === "0") return ""
  return `modifiée par l'avenant ${ref}`
}

// Construit {signataire.*} à partir des colonnes contact_* du client.
// Contexte "suiveur" à partir de la liste des suiveurs d'une étude (etude_suiveurs).
// Plusieurs suiveurs -> prenom/nom/email deviennent des listes séparées par ", ".
function buildSuiveurContext(suiveurs: any[]) {
  const list = (suiveurs ?? []).filter(Boolean)
  return {
    prenom: list.map((s) => s.prenom).filter(Boolean).join(", "),
    nom: list.map((s) => s.nom).filter(Boolean).join(", "),
    email: list.map((s) => s.email).filter(Boolean).join(", "),
  }
}

function buildSignataire(clientData: any) {
  return {
    civilite: clientData?.contact_civilite || "",
    prenom: clientData?.contact_prenom || "",
    nom: clientData?.contact_nom || "",
    poste: clientData?.contact_poste || "",
    fonction: clientData?.contact_poste || "",
    email: clientData?.contact_email || "",
    telephone: clientData?.contact_phone || "",
  }
}

// Déchiffre le NSS d'une personne en gérant LES DEUX formats historiques :
// - 3 colonnes nss_encrypted + nss_iv + nss_auth_tag (lib/crypto, PUT /api/profil)
// - mono-chaîne "iv:tag:ciphertext" dans nss_encrypted seul (lib/encryption, /api/profil/sensitive)
// Retourne "" si absent ou indéchiffrable — ne jette jamais.
function decryptNss(person: any): string {
  if (!person?.nss_encrypted) return ""
  try {
    if (person.nss_iv && person.nss_auth_tag && person.encryption_salt) {
      return decryptData(person.nss_encrypted, person.nss_iv, person.nss_auth_tag, getMasterKey(), person.encryption_salt) || ""
    }
    return decryptFromString(person.nss_encrypted) || ""
  } catch {
    return ""
  }
}

// Build étudiant/intervenant context from a personne record.
// Only extract primitive fields — skip nested Supabase join objects.
function buildIntervenantContext(person: any) {
  if (!person || Object.keys(person).length === 0) return {}
  const ctx: Record<string, any> = {}
  for (const [k, v] of Object.entries(person)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) continue
    ctx[k] = v ?? ""
  }
  return ctx
}

/**
 * Construit un contexte complet pour le remplissage des templates DOCX.
 *
 * Placeholders supportés :
 * - {date}, {today}, {annee}, {date_iso}
 * - {etude.*} — toutes les colonnes de l'étude
 * - {mission.*} — toutes les colonnes de la mission
 * - {client.*} / {entreprise.*} — toutes les colonnes du client
 * - {signataire.*} — contact signataire côté client
 * - {suiveur.*} — le suiveur de l'étude
 * - {intervenant.*} — l'intervenant sélectionné
 * - {etudiant.*}, {etudiant_*} — alias pour l'intervenant
 * - {president.*} — le/la président(e) de la JE (depuis parametres)
 * - {tresorier.*} — le/la trésorier(e)
 * - {structure.*} — coordonnées de l'association
 * - {facturation.*}, {phases} — pour le scope "facture"
 * - {reference} — le numéro d'étude
 * - {phases}, {planning}, {nb_jeh}, {nb_phases}
 */
export async function buildTemplateContext(
  scope: "etude" | "mission" | "personne" | "general" | "facture",
  entityId: string,
  intervenantId?: string,
  options?: { includeNss?: boolean }
): Promise<Record<string, any>> {
  if (scope === "facture") return buildFactureContext(entityId)

  const client = createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  // Use admin client to bypass RLS — we need to read any user's profile
  const sb = createAdminClient()
  const today = new Date()

  // Load structure parameters in parallel with entity data
  const paramsPromise = loadStructureParams(sb)

  const base: Record<string, any> = {
    date: formatDateFR(today),
    today: formatDateFR(today),
    date_iso: today.toISOString().slice(0, 10),
    annee: String(today.getFullYear()),
  }

  if (scope === "mission") {

    // Step 1: Fetch mission alone (no joins — most reliable)
    const [{ data: m, error: mErr }, params] = await Promise.all([
      sb.from("missions").select("*").eq("id", entityId).single(),
      paramsPromise,
    ])
    if (mErr || !m) {
      return base
    }

    // Step 2: Fetch related data IN PARALLEL via separate queries
    const [etudeRes, intervenantRes, blocsRes, rdmDocRes] = await Promise.all([
      // Etude (if mission has etude_id)
      m.etude_id
        ? sb.from("etudes").select("*").eq("id", m.etude_id).single()
        : Promise.resolve({ data: null, error: null }),
      // Intervenant: use explicit ID if provided, else mission.intervenant_id
      (intervenantId || m.intervenant_id)
        ? sb.from("personnes").select("*").eq("id", intervenantId || m.intervenant_id).single()
        : Promise.resolve({ data: null, error: null }),
      // Phases (echeancier_blocs) — only if mission has etude_id
      m.etude_id
        ? sb.from("echeancier_blocs").select("*").eq("etude_id", m.etude_id)
        : Promise.resolve({ data: [], error: null }),
      // Dernier RDM généré pour cette mission (pour {mission.reference_recap_mission})
      sb
        .from("generated_documents")
        .select("file_name, created_at, document_templates!inner(category)")
        .eq("scope", "mission")
        .eq("entity_id", entityId)
        .eq("document_templates.category", "rdm")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    const etude: any = (etudeRes as any).data || {}
    const selectedIntervenant: any = (intervenantRes as any).data
    const blocs: any[] = (blocsRes as any).data || []
    const rdmDoc: any = (rdmDocRes as any)?.data
    const referenceRecapMission = rdmDoc?.file_name ? String(rdmDoc.file_name).replace(/\.(docx|pdf|pptx)$/i, "") : ""


    // Step 3: Fetch client and suiveurs for the etude (in parallel)
    const [clientRes, suiveursRes] = await Promise.all([
      etude.client_id
        ? sb.from("clients").select("*").eq("id", etude.client_id).single()
        : Promise.resolve({ data: null, error: null }),
      etude.id
        ? sb.from("etude_suiveurs").select("personnes(id, prenom, nom, email)").eq("etude_id", etude.id)
        : Promise.resolve({ data: [], error: null }),
    ])

    const clientData: any = (clientRes as any).data || {}
    const suiveur = buildSuiveurContext(((suiveursRes as any).data ?? []).map((r: any) => r.personnes))

    const { phases, nb_jeh, nb_phases, planning } = buildPhasesContext(blocs)

    // budget_ht est saisi TTC-marge-comprise (la marge est déjà dedans) : on ne
    // l'ajoute pas une seconde fois, marge_euros n'est qu'informatif.
    const budget_ht = Number(etude.budget_ht) || 0
    const frais = Number(etude.frais_dossier) || 0
    const margePct = Number(etude.marge_pct) || 0
    const tarif = budget_ht + frais

    const intervenantCtx = buildIntervenantContext(selectedIntervenant)

    // NSS déchiffré — uniquement pour le Bulletin de Versement, jamais par défaut.
    // La ligne personnes est déjà chargée : aucun aller-retour supplémentaire.
    if (options?.includeNss && selectedIntervenant) {
      intervenantCtx.num_secu = decryptNss(selectedIntervenant)
    }

    const organigramme = buildOrganigramme(params)

    // Extract only primitive fields from mission
    const missionPrimitives: Record<string, any> = {}
    for (const [k, v] of Object.entries(m as Record<string, any>)) {
      if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) continue
      missionPrimitives[k] = v ?? ""
    }

    // nb_jeh/remuneration (migrations 013/014) sont le modèle actuel ;
    // nb_jours/taux_jour est l'ancien modèle, gardé en repli.
    const missionNbJeh = Number(m.nb_jeh) || Number(m.nb_jours) || 0
    const missionRemuneration =
      Number(m.nb_jeh) && Number(m.remuneration)
        ? Number(m.nb_jeh) * Number(m.remuneration)
        : (Number(m.nb_jours) || 0) * (Number(m.taux_jour) || 0)
    const missionDureeJours = computeDureeJours(m.date_debut, m.date_fin) || Number(m.nb_jours) || 0

    return {
      ...base,
      // Reference = numéro d'étude
      reference: etude.numero || "",
      // Mission — only primitive fields + formatted dates
      mission: {
        ...missionPrimitives,
        date_debut: fmtDate(m.date_debut),
        date_fin: fmtDate(m.date_fin),
        date_debut_iso: m.date_debut || "",
        date_fin_iso: m.date_fin || "",
        numero_etude: (etude.numero || "").slice(-2),
        numero_etude_complet: etude.numero || "",
        nombre_jeh: missionNbJeh,
        montant_remuneration: missionRemuneration,
        // Le RDM exprime la durée en semaines ("d'une durée de X semaines")
        duree: Math.ceil(missionDureeJours / 7),
        duree_jours: missionDureeJours,
        duree_semaines: Math.ceil(missionDureeJours / 7),
        reference_recap_mission: referenceRecapMission,
      },
      // Bulletin de Versement : tableau des cotisations URSSAF précalculé
      bv: buildBvContext(params, missionNbJeh, missionRemuneration),
      // Étude — dates formatted DD/MM/YYYY
      etude: {
        ...etude,
        date_debut: fmtDate(etude.date_debut),
        date_fin: fmtDate(etude.date_fin),
        date_debut_iso: etude.date_debut || "",
        date_fin_iso: etude.date_fin || "",
        prix: tarif.toFixed(2),
        frais: frais.toFixed(2),
        tarif_ht: tarif.toFixed(2),
        marge_euros: (budget_ht * (margePct / 100)).toFixed(2),
        nb_jeh,
        nb_phases,
        mention_avenant: buildMentionAvenant(etude),
      },
      // Flat aliases for convenience (top-level)
      date_debut: fmtDate(etude.date_debut),
      date_fin: fmtDate(etude.date_fin),
      // Client (extract first from array if needed)
      client: clientData,
      // Entreprise = alias pour client ({entreprise.nom}, {entreprise.adresse}, ...)
      entreprise: clientData,
      // Signataire = interlocuteur client signataire ({signataire.civilite/prenom/nom/poste})
      signataire: buildSignataire(clientData),
      // Suiveur (fetched independently)
      suiveur,
      // Intervenant (accessible via {intervenant.prenom})
      intervenant: intervenantCtx,
      // Étudiant = alias pour intervenant ({etudiant.*}, {étudiant.*} avec accent, {etudiant_*})
      etudiant: intervenantCtx,
      "étudiant": intervenantCtx,
      etudiant_prenom: intervenantCtx.prenom,
      etudiant_nom: intervenantCtx.nom,
      etudiant_adresse: intervenantCtx.adresse,
      etudiant_code_postal: intervenantCtx.code_postal,
      etudiant_ville: intervenantCtx.ville,
      // Organigramme (président, trésorier, structure)
      ...organigramme,
      // Phases & planning
      phases,
      planning,
      nb_jeh,
      nb_phases,
    }
  }

  if (scope === "etude") {

    // Step 1: Fetch etude alone (no joins)
    const [{ data: e, error: eErr }, params] = await Promise.all([
      sb.from("etudes").select("*").eq("id", entityId).single(),
      paramsPromise,
    ])
    if (eErr || !e) {
      return base
    }
    const eAny = e as any

    // Step 2: Fetch client, suiveurs, blocs, intervenant in PARALLEL
    const [clientRes, suiveursRes, blocsRes, intervenantRes] = await Promise.all([
      eAny.client_id
        ? sb.from("clients").select("*").eq("id", eAny.client_id).single()
        : Promise.resolve({ data: null, error: null }),
      sb.from("etude_suiveurs").select("personnes(id, prenom, nom, email)").eq("etude_id", entityId),
      sb.from("echeancier_blocs").select("*").eq("etude_id", entityId),
      intervenantId
        ? sb.from("personnes").select("*").eq("id", intervenantId).single()
        : Promise.resolve({ data: null, error: null }),
    ])

    const clientData: any = (clientRes as any).data || {}
    const suiveur = buildSuiveurContext(((suiveursRes as any).data ?? []).map((r: any) => r.personnes))
    const blocs: any[] = (blocsRes as any).data || []
    const selectedIntervenant: any = (intervenantRes as any).data

    // budget_ht est saisi TTC-marge-comprise (la marge est déjà dedans) : on ne
    // l'ajoute pas une seconde fois, marge_euros n'est qu'informatif.
    const budget_ht = Number(eAny.budget_ht) || 0
    const frais = Number(eAny.frais_dossier) || 0
    const margePct = Number(eAny.marge_pct) || 0
    const tarif = budget_ht + frais

    const { phases, nb_jeh, nb_phases, planning } = buildPhasesContext(blocs)
    const organigramme = buildOrganigramme(params)
    const intervenantCtx = buildIntervenantContext(selectedIntervenant)

    return {
      ...base,
      reference: eAny.numero || "",
      etude: {
        ...e,
        date_debut: fmtDate(eAny.date_debut),
        date_fin: fmtDate(eAny.date_fin),
        date_debut_iso: eAny.date_debut || "",
        date_fin_iso: eAny.date_fin || "",
        prix: tarif.toFixed(2),
        frais: frais.toFixed(2),
        tarif_ht: tarif.toFixed(2),
        marge_euros: (budget_ht * (margePct / 100)).toFixed(2),
        nb_jeh,
        nb_phases,
        mention_avenant: buildMentionAvenant(eAny),
      },
      date_debut: fmtDate(eAny.date_debut),
      date_fin: fmtDate(eAny.date_fin),
      client: clientData,
      entreprise: clientData,
      signataire: buildSignataire(clientData),
      suiveur,
      intervenant: intervenantCtx,
      etudiant: intervenantCtx,
      "étudiant": intervenantCtx,
      etudiant_prenom: intervenantCtx.prenom,
      etudiant_nom: intervenantCtx.nom,
      etudiant_adresse: intervenantCtx.adresse,
      etudiant_code_postal: intervenantCtx.code_postal,
      etudiant_ville: intervenantCtx.ville,
      ...organigramme,
      phases,
      planning,
      nb_jeh,
      nb_phases,
    }
  }

  if (scope === "personne") {
    const [{ data: p }, params] = await Promise.all([
      sb.from("personnes").select("*").eq("id", entityId).single(),
      paramsPromise,
    ])
    const intervenantCtx = buildIntervenantContext(p)
    const organigramme = buildOrganigramme(params)
    return {
      ...base,
      personne: p ?? {},
      etudiant: intervenantCtx,
      "étudiant": intervenantCtx,
      etudiant_prenom: intervenantCtx.prenom,
      etudiant_nom: intervenantCtx.nom,
      ...organigramme,
    }
  }

  // general scope
  const params = await paramsPromise
  const organigramme = buildOrganigramme(params)
  return { ...base, ...organigramme }
}

/**
 * Construit le contexte pour la génération d'une Facture ({facturation.*}).
 * Calcule côté serveur tout ce qui était auparavant des expressions en dur
 * dans le docx (montants, TVA, déjà facturé, libellés par type de facture) —
 * le template ne doit plus contenir que des balises simples et des sections
 * {#facturation.est_acompte}/{#facturation.est_intermediaire}/{#facturation.est_solde}.
 */
async function buildFactureContext(factureId: string): Promise<Record<string, any>> {
  const client = createClient()
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const sb = createAdminClient()
  const today = new Date()

  const base: Record<string, any> = {
    date: formatDateFR(today),
    today: formatDateFR(today),
    date_iso: today.toISOString().slice(0, 10),
    annee: String(today.getFullYear()),
  }

  const [{ data: facture, error: fErr }, params] = await Promise.all([
    sb.from("factures").select("*").eq("id", factureId).single(),
    loadStructureParams(sb),
  ])
  if (fErr || !facture) return base

  const [etudeRes, autresFacturesRes, blocsRes] = await Promise.all([
    facture.etude_id
      ? sb.from("etudes").select("*").eq("id", facture.etude_id).single()
      : Promise.resolve({ data: null, error: null }),
    facture.etude_id
      ? sb.from("factures").select("montant_ht, date_emission").eq("etude_id", facture.etude_id).neq("id", factureId)
      : Promise.resolve({ data: [], error: null }),
    facture.etude_id
      ? sb.from("echeancier_blocs").select("*").eq("etude_id", facture.etude_id)
      : Promise.resolve({ data: [], error: null }),
  ])

  const etude: any = (etudeRes as any).data || {}
  const autresFactures: any[] = (autresFacturesRes as any).data || []
  const allBlocs: any[] = (blocsRes as any).data || []

  const clientRes = etude.client_id
    ? await sb.from("clients").select("*").eq("id", etude.client_id).single()
    : { data: null, error: null }
  const clientData: any = (clientRes as any).data || {}

  // Si la facture est liée à une phase précise, ne montrer que celle-ci dans {#phases} ;
  // sinon, montrer l'intégralité de l'échéancier de l'étude.
  const relevantBlocs = facture.bloc_id ? allBlocs.filter((b) => b.id === facture.bloc_id) : allBlocs
  const { phases, nb_jeh, nb_phases, planning } = buildPhasesContext(relevantBlocs)

  // budget_ht est saisi TTC-marge-comprise (la marge est déjà dedans) : on ne
  // l'ajoute pas une seconde fois, marge_euros n'est qu'informatif.
  const budget_ht = Number(etude.budget_ht) || 0
  const frais = Number(etude.frais_dossier) || 0
  const margePct = Number(etude.marge_pct) || 0
  const totalHtEtude = budget_ht + frais

  // Ne compter que les factures précédentes (émises avant celle-ci, ou sans date si celle-ci n'en a pas non plus)
  const dateEmissionCourante = facture.date_emission ? new Date(facture.date_emission).getTime() : null
  const totalDejaFacture = autresFactures.reduce((sum, f: any) => {
    if (dateEmissionCourante && f.date_emission) {
      if (new Date(f.date_emission).getTime() >= dateEmissionCourante) return sum
    }
    return sum + (Number(f.montant_ht) || 0)
  }, 0)

  const montantHt = Number(facture.montant_ht) || 0
  // tva_rate = clé éditée dans la page Paramètres ; tva_taux = repli migration 046
  const tvaTaux = Number(params.tva_rate) || Number(params.tva_taux) || 0
  const montantTva = montantHt * (tvaTaux / 100)
  const montantTtc = montantHt + montantTva
  const soldeRestant = Math.max(0, totalHtEtude - totalDejaFacture - montantHt)

  const type = facture.type || ""
  const estAcompte = type === "acompte"
  const typeLibelles: Record<string, string> = {
    acompte: "d'acompte",
    intermediaire: "intermédiaire",
    solde: "de solde",
  }

  const organigramme = buildOrganigramme(params)

  return {
    ...base,
    reference: etude.numero || "",
    etude: {
      ...etude,
      date_debut: fmtDate(etude.date_debut),
      date_fin: fmtDate(etude.date_fin),
      prix: totalHtEtude.toFixed(2),
      frais: frais.toFixed(2),
      tarif_ht: totalHtEtude.toFixed(2),
      nb_jeh,
      nb_phases,
      mention_avenant: buildMentionAvenant(etude),
    },
    client: clientData,
    entreprise: clientData,
    signataire: buildSignataire(clientData),
    ...organigramme,
    phases,
    planning,
    nb_jeh,
    nb_phases,
    facturation: {
      numero: facture.numero || "",
      numero_global: facture.numero || "",
      nom: facture.nom || "",
      type,
      type_libelle: typeLibelles[type] || "",
      est_acompte: estAcompte,
      est_intermediaire: type === "intermediaire",
      est_solde: type === "solde",
      non_acompte: !estAcompte,
      accompte_pct: facture.accompte_pct || 0,
      montant_ht: montantHt,
      montant_tva: montantTva,
      montant_ttc: montantTtc,
      tva_taux: tvaTaux,
      total_deja_facture: totalDejaFacture,
      total_ht_etude: totalHtEtude,
      solde_restant: soldeRestant,
      // Bloc "totaux" de la facture (libellés + montants qui étaient des
      // ternaires dans l'ancien modèle Word)
      total_prestation: estAcompte ? totalHtEtude - frais : totalDejaFacture + montantHt,
      ligne_frais: estAcompte ? frais : 0,
      libelle_deduction: estAcompte ? "Total HT de l'étude" : "Déduction des factures précédentes (HT)",
      montant_deduction: estAcompte ? totalHtEtude : totalDejaFacture,
      libelle_ligne: estAcompte ? `Montant de l'acompte (${facture.accompte_pct || 0}%)` : "Total HT",
      mention_tva_acompte: estAcompte ? " sur l'acompte" : "",
      libelle_ttc: estAcompte ? "Acompte" : "Total",
      emitted_at: fmtDate(facture.date_emission),
      due_at: fmtDate(facture.date_echeance),
      paid_at: fmtDate(facture.date_paiement),
      notes: facture.notes || "",
    },
  }
}
