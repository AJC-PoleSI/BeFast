"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath, revalidateTag, unstable_cache, unstable_noStore as noStore } from "next/cache"
import { MISSIONS_TAG, MISSION_DETAIL_TAG, CANDIDATURES_TAG } from "@/lib/cache-tags"
import { sendEmail } from "@/lib/email/send"
import {
  candidatureAccepteeEmail,
  candidatureRefuseeEmail,
  intervenantAffecteEmail,
} from "@/lib/email/templates"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { requireActionPermission } from "@/lib/auth/action-guards"
import { hasPermission, hasAnyPermission, canEditEtude } from "@/lib/auth/permissions"
import { estMissionPubliee } from "@/lib/mission-visibilite"
import {
  motifRefusAffectation,
  avertissementsAffectation,
  STATUTS_AFFECTABLES,
} from "@/lib/missions/affectation"
import { missingProfileFieldsFromRow, BA_REQUIRED_DOC_TYPES } from "@/lib/signature/ba"

// Liste des missions — PAS de cache. Les utilisateurs créent/modifient
// fréquemment leurs missions et doivent toujours voir leur travail.
export async function getMissions(filters?: {
  type?: string
  voie?: string
  classe?: string
  statut?: string
}) {
  noStore()
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  let query = supabase
    .from("missions")
    .select("id, nom, description, type, voie, classe, statut, nb_jeh, nb_intervenants, remuneration, etude_id, created_at, published, etudes(id, nom, numero, published)")
    .neq("type", "chef_projet")
    .order("created_at", { ascending: false })

  if (filters?.type && filters.type !== "chef_projet") query = query.eq("type", filters.type)
  if (filters?.voie) query = query.eq("voie", filters.voie)
  if (filters?.classe) query = query.eq("classe", filters.classe)
  if (filters?.statut) query = query.eq("statut", filters.statut)

  const { data, error } = await query
  if (error) return { error: error.message }
  // Étude publiée ET mission publiée (publication mission par mission).
  const filtered = (data ?? []).filter((m: any) => estMissionPubliee(m))
  return { data: filtered }
}

// Détail d'une mission — PAS de cache pour garantir la fraîcheur après modification.
export async function getMission(id: string) {
  noStore()
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data, error } = await supabase
    .from("missions")
    .select("*, etudes(id, nom, numero)")
    .eq("id", id)
    .single()
  if (error) return { error: error.message }
  return { data }
}

const COLONNES_MISSION_FORMULAIRE = [
  "etude_id",
  "nom",
  "description",
  "type",
  "voie",
  "classe",
  "langues",
  "date_debut",
  "date_fin",
  "remuneration",
  "nb_jeh",
  "nb_intervenants",
] as const

export async function createMission(formData: {
  etude_id?: string
  nom: string
  description?: string
  type: string
  voie?: string
  classe?: string
  langues?: string[]
  date_debut?: string
  date_fin?: string
  remuneration?: number
  nb_jeh?: number
  nb_intervenants?: number
}) {
  // Création d'une mission : permission `nouvelle_mission`.
  const guard = await requireActionPermission(
    "nouvelle_mission",
    "Vous n'avez pas la permission de créer une mission."
  )
  if (!guard.ok) return { error: guard.error }

  const supabase = createClient()

  // Liste blanche : l'objet reçu du client ne doit jamais pouvoir porter
  // `published`, `intervenant_id` ou `created_by` (affectation de masse).
  const payload: Record<string, unknown> = { created_by: guard.userId }
  for (const k of COLONNES_MISSION_FORMULAIRE) {
    if (formData[k] !== undefined) payload[k] = formData[k]
  }

  const { data, error } = await supabase
    .from("missions")
    .insert(payload)
    .select()
    .single()

  if (error) return { error: error.message }

  // Auto-create un bloc dans l'échéancier pour la mission
  if (data && formData.etude_id) {
    // Trouver la semaine max déjà utilisée pour placer le nouveau bloc à la suite
    const { data: existingBlocs } = await supabase
      .from("echeancier_blocs")
      .select("semaine_debut, duree_semaines")
      .eq("etude_id", formData.etude_id)
    const maxSemaine = (existingBlocs ?? []).reduce(
      (max, b) => Math.max(max, (b.semaine_debut ?? 1) + (b.duree_semaines ?? 1) - 1),
      0
    )
    const jehTotal = (formData.nb_jeh ?? 0) * (formData.nb_intervenants ?? 1)
    await supabase.from("echeancier_blocs").insert({
      etude_id: formData.etude_id,
      mission_id: data.id,
      nom: formData.nom,
      semaine_debut: maxSemaine + 1,
      duree_semaines: Math.max(1, Math.ceil(jehTotal / 5)), // ~5 JEH/semaine par défaut
      jeh: jehTotal || null,
      couleur: "#00236f",
    })
  }

  revalidateTag(MISSIONS_TAG)
  revalidatePath("/missions")
  if (formData.etude_id) revalidatePath(`/etudes/${formData.etude_id}`)
  return { data }
}

export async function updateMissionStatut(id: string, statut: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { error } = await supabase
    .from("missions")
    .update({ statut })
    .eq("id", id)

  if (error) return { error: error.message }
  revalidateTag(MISSIONS_TAG)
  revalidateTag(MISSION_DETAIL_TAG(id))
  revalidatePath("/missions")
  return { success: true }
}

// ---- Candidatures ----

export async function candidaterMission(formData: {
  mission_id: string
  motivation: string
  classe?: string
  langues?: { langue: string; niveau: string }[]
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: "Non authentifié" }

  const { data, error } = await supabase
    .from("candidatures")
    .insert({
      mission_id: formData.mission_id,
      personne_id: user.id,
      motivation: formData.motivation,
      classe: formData.classe ? formData.classe.toLowerCase() : null,
      langues: formData.langues || [],
    })
    .select()
    .single()

  if (error) {
    if (error.code === "23505") {
      return { error: "Vous avez déjà candidaté à cette mission." }
    }
    // RLS "candidatures insert own" (migration 074) : hors membres internes,
    // on ne candidate qu'à une mission publiée sous une étude publiée.
    if (error.code === "42501") {
      return { error: "Cette mission n'est pas encore ouverte à la candidature." }
    }
    return { error: error.message }
  }
  revalidateTag(`candidatures:${user.id}`)
  revalidatePath(`/missions/${formData.mission_id}`)
  return { data }
}

// PAS de cache — les candidatures changent fréquemment et l'utilisateur
// doit toujours voir leur état réel.
export async function getMesCandidatures() {
  noStore()
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data, error } = await supabase
    .from("candidatures")
    .select("*, missions(id, nom, statut)")
    .eq("personne_id", user.id)
    .order("created_at", { ascending: false })
  if (error) return { error: error.message }
  return { data }
}

export async function getCandidaturesMission(missionId: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data, error } = await supabase
    .from("candidatures")
    .select("*, personnes!candidatures_personne_id_fkey(id, prenom, nom, email)")
    .eq("mission_id", missionId)
    .order("created_at", { ascending: true })

  if (error) return { error: error.message }
  return { data }
}

/**
 * Accepter ou refuser une candidature.
 *
 * Réservé aux détenteurs de `selectionner_candidats` (RH) et aux
 * administrateurs. Le candidat est notifié par email dans les deux cas :
 * refus courtois, ou acceptation mentionnant le ou les chefs de projet qui
 * vont le contacter.
 */
export async function repondreCandidature(
  candidatureId: string,
  statut: "acceptee" | "refusee"
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  // Accepter une candidature = assigner l'intervenant à la mission : les deux
  // clés du catalogue (« Accepter / refuser les candidatures » et « Assigner
  // des intervenants ») ouvrent donc la même décision.
  const profile = await getCachedProfile(user.id)
  if (!hasAnyPermission(profile, ["selectionner_candidats", "assigner_intervenants"])) {
    return { error: "Seuls le pôle RH et les administrateurs peuvent accepter ou refuser une candidature." }
  }

  // Lecture via le client admin : la décision est déjà autorisée ci-dessus, et
  // un membre RH n'a pas forcément le rôle de base « interne » exigé par la RLS.
  const admin = createAdminClient()

  const { data: cand } = await admin
    .from("candidatures")
    .select(
      "personne_id, mission_id, personnes!candidatures_personne_id_fkey(prenom, email), missions(nom, suiveur_id, etude_id)"
    )
    .eq("id", candidatureId)
    .single()

  if (!cand) return { error: "Candidature introuvable" }

  const { error } = await admin
    .from("candidatures")
    .update({ statut, reponse_date: new Date().toISOString() })
    .eq("id", candidatureId)

  if (error) return { error: error.message }
  if (cand.personne_id) revalidateTag(CANDIDATURES_TAG(cand.personne_id))
  revalidatePath("/missions")

  // Notification best-effort au candidat : un échec d'email ne doit pas
  // annuler la décision, déjà enregistrée.
  const personne = cand.personnes as { prenom?: string | null; email?: string | null } | null
  const mission = cand.missions as {
    nom?: string | null
    suiveur_id?: string | null
    etude_id?: string | null
  } | null
  const missionNom = mission?.nom ?? "la mission"

  if (personne?.email) {
    const tpl =
      statut === "acceptee"
        ? candidatureAccepteeEmail({
            prenom: personne.prenom ?? null,
            missionNom,
            chefsDeProjet: await getChefsDeProjet(admin, mission),
          })
        : candidatureRefuseeEmail({ prenom: personne.prenom ?? null, missionNom })
    await sendEmail({ to: personne.email, subject: tpl.subject, html: tpl.html })
  }

  return { success: true }
}

/**
 * Noms des chefs de projet à annoncer au candidat retenu : le suiveur de la
 * mission s'il est renseigné, sinon les suiveurs de l'étude.
 */
async function getChefsDeProjet(
  admin: ReturnType<typeof createAdminClient>,
  mission: { suiveur_id?: string | null; etude_id?: string | null } | null
): Promise<string[]> {
  const nomComplet = (p: { prenom?: string | null; nom?: string | null } | null) =>
    p ? [p.prenom, p.nom].filter(Boolean).join(" ") : ""

  if (mission?.suiveur_id) {
    const { data } = await admin
      .from("personnes")
      .select("prenom, nom")
      .eq("id", mission.suiveur_id)
      .single()
    const nom = nomComplet(data)
    if (nom) return [nom]
  }

  if (!mission?.etude_id) return []

  const [{ data: etude }, { data: suiveurs }] = await Promise.all([
    admin.from("etudes").select("suiveur:personnes!etudes_suiveur_id_fkey(prenom, nom)").eq("id", mission.etude_id).single(),
    admin.from("etude_suiveurs").select("personnes(prenom, nom)").eq("etude_id", mission.etude_id),
  ])

  const noms = (suiveurs ?? [])
    .map((s) => nomComplet(s.personnes as { prenom?: string | null; nom?: string | null } | null))
    .filter(Boolean)
  if (noms.length > 0) return noms

  const principal = nomComplet(
    (etude?.suiveur ?? null) as { prenom?: string | null; nom?: string | null } | null
  )
  return principal ? [principal] : []
}

/**
 * Affecter directement un intervenant = même décision qu'accepter une
 * candidature : RH (`selectionner_candidats` / `assigner_intervenants`) et
 * administrateurs.
 */
async function getAffecteur() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" as const }

  const profile = await getCachedProfile(user.id)
  if (
    !hasPermission(profile, "selectionner_candidats") &&
    !hasPermission(profile, "assigner_intervenants")
  ) {
    return { error: "Seuls le pôle RH et les administrateurs peuvent affecter un intervenant." as const }
  }
  return { userId: user.id }
}

/** Lit toutes les lignes d'une requête PostgREST, plafonnée à 1000 par appel. */
async function toutesLesLignes<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const PAGE = 1000
  const lignes: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    lignes.push(...(data ?? []))
    if (!data || data.length < PAGE) return lignes
  }
}

/**
 * Tous les comptes affectables à la mission (validés ou en attente de
 * validation), hors personnes déjà positionnées dessus — celles-là se gèrent
 * avec « Accepter » / « Refuser » sur leur candidature. Chaque compte porte
 * ses avertissements (compte non validé, dossier incomplet : champs et
 * justificatifs exigés pour le BA, chiffrés testés sans déchiffrer) ; ils
 * n'empêchent pas l'affectation.
 *
 * Chargée UNE fois à l'ouverture de la fenêtre « Affecter » : la recherche se
 * filtre ensuite côté navigateur (filtrerAffectables), sans aller-retour
 * serveur à chaque frappe. ~800 comptes, une centaine de ko.
 */
export async function listerIntervenantsAffectables(missionId: string) {
  const acces = await getAffecteur()
  if ("error" in acces) return { error: acces.error }

  // Client admin : la permission est vérifiée ci-dessus, et la RLS de
  // `personnes` ne laisse pas forcément un membre RH lire tous les comptes.
  const admin = createAdminClient()
  try {
    const [deja, personnes, docs] = await Promise.all([
      toutesLesLignes<{ personne_id: string }>((from, to) =>
        admin.from("candidatures").select("personne_id").eq("mission_id", missionId).range(from, to)
      ),
      toutesLesLignes<any>((from, to) =>
        admin
          .from("personnes")
          .select(
            "id, prenom, nom, email, account_status, portable, date_naissance, adresse, ville, code_postal, etablissement, scolarite, adresse_encrypted, ville_encrypted, code_postal_encrypted, date_naissance_encrypted, profils_types!profil_type_id(nom)"
          )
          .in("account_status", [...STATUTS_AFFECTABLES])
          .order("nom", { ascending: true })
          .order("id", { ascending: true })
          .range(from, to)
      ),
      toutesLesLignes<{ personne_id: string; type: string }>((from, to) =>
        admin
          .from("documents_personnes")
          .select("personne_id, type")
          .in("type", [...BA_REQUIRED_DOC_TYPES])
          .range(from, to)
      ),
    ])

    const exclus = new Set(deja.map((d) => d.personne_id))
    const deposes = new Map<string, Set<string>>()
    for (const d of docs) {
      if (!deposes.has(d.personne_id)) deposes.set(d.personne_id, new Set())
      deposes.get(d.personne_id)!.add(d.type)
    }

    const data = personnes
      .filter((p) => !exclus.has(p.id))
      .map((p) => {
        const types = deposes.get(p.id) ?? new Set<string>()
        const manquants = [
          ...missingProfileFieldsFromRow(p),
          ...BA_REQUIRED_DOC_TYPES.filter((t) => !types.has(t)),
        ]
        return {
          id: p.id as string,
          prenom: p.prenom as string | null,
          nom: p.nom as string | null,
          email: p.email as string | null,
          role: (p.profils_types as { nom?: string | null } | null)?.nom ?? null,
          avertissements: avertissementsAffectation({ account_status: p.account_status, manquants }),
        }
      })
    return { data }
  } catch (e) {
    return { error: (e as Error).message }
  }
}

/**
 * Affecte un intervenant à une mission sans qu'il ait postulé : crée sa
 * candidature directement au statut « acceptee » (cf. lib/missions/affectation).
 * L'email est optionnel — l'admin a pu prévenir la personne autrement.
 */
export async function affecterIntervenant(
  missionId: string,
  personneId: string,
  opts: { notifier: boolean }
) {
  const acces = await getAffecteur()
  if ("error" in acces) return { error: acces.error }

  const admin = createAdminClient()
  const [{ data: mission }, { data: personne }, { data: cands }] = await Promise.all([
    admin.from("missions").select("nom, nb_intervenants, suiveur_id, etude_id").eq("id", missionId).single(),
    admin.from("personnes").select("prenom, email, account_status").eq("id", personneId).maybeSingle(),
    admin.from("candidatures").select("personne_id, statut").eq("mission_id", missionId),
  ])
  if (!mission) return { error: "Mission introuvable" }

  const motif = motifRefusAffectation({
    personne,
    dejaSurMission: (cands ?? []).some((c) => c.personne_id === personneId),
    accepteesCount: (cands ?? []).filter((c) => c.statut === "acceptee").length,
    nbIntervenants: mission.nb_intervenants,
  })
  if (motif) return { error: motif }

  const { error } = await admin.from("candidatures").insert({
    mission_id: missionId,
    personne_id: personneId,
    statut: "acceptee",
    created_by: acces.userId,
    reponse_date: new Date().toISOString(),
  })
  if (error) {
    if (error.code === "23505") return { error: "Cette personne est déjà positionnée sur la mission." }
    return { error: error.message }
  }
  revalidateTag(CANDIDATURES_TAG(personneId))
  revalidatePath("/missions")

  // Best-effort, comme pour une candidature acceptée : l'affectation est déjà
  // enregistrée, un échec d'email ne doit pas l'annuler.
  if (opts.notifier && personne?.email) {
    const tpl = intervenantAffecteEmail({
      prenom: personne.prenom ?? null,
      missionNom: mission.nom ?? "la mission",
      chefsDeProjet: await getChefsDeProjet(admin, mission),
    })
    await sendEmail({ to: personne.email, subject: tpl.subject, html: tpl.html })
  }

  return { success: true }
}

/**
 * Supprime une mission. Même droit que la créer/modifier sur son étude
 * (canEditEtude : admin, créateur de l'étude, suiveur, `modifier_etudes`),
 * aligné sur la policy RLS "missions delete" (migration 070). Candidatures,
 * notes de frais, suivi intervenant et bloc d'échéancier partent en cascade.
 */
export async function deleteMission(id: string) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const { data: mission } = await supabase
    .from("missions")
    .select("etude_id")
    .eq("id", id)
    .single()
  if (!mission) return { error: "Mission introuvable" }

  const { data: etude } = mission.etude_id
    ? await supabase
        .from("etudes")
        .select("created_by, etude_suiveurs(personne_id)")
        .eq("id", mission.etude_id)
        .single()
    : { data: null }

  const profile = await getCachedProfile(user.id)
  const acces = {
    created_by: etude?.created_by ?? null,
    suiveurs: (etude?.etude_suiveurs ?? []).map((s: { personne_id: string }) => ({
      id: s.personne_id,
    })),
  }
  if (!canEditEtude(profile, acces)) {
    return { error: "Vous n'êtes pas autorisé à supprimer cette mission." }
  }

  // Candidats à prévenir côté cache avant que la cascade n'efface leurs lignes.
  const { data: cands } = await supabase
    .from("candidatures")
    .select("personne_id")
    .eq("mission_id", id)

  // `.select()` : sans ligne renvoyée, la RLS a filtré le DELETE en silence.
  const { data, error } = await supabase
    .from("missions")
    .delete()
    .eq("id", id)
    .select("id")
  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: "Mission introuvable ou suppression refusée." }
  }

  for (const c of cands ?? []) {
    if (c.personne_id) revalidateTag(CANDIDATURES_TAG(c.personne_id))
  }
  revalidateTag(MISSIONS_TAG)
  revalidateTag(MISSION_DETAIL_TAG(id))
  revalidatePath("/missions")
  if (mission.etude_id) revalidatePath(`/etudes/${mission.etude_id}`)
  return { success: true }
}
