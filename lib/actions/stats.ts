"use server"

import { createClient } from "@/lib/supabase/server"
import { jehTotalMission, montantTotalMission } from "@/lib/missions/remuneration"
import { requireActionPermission } from "@/lib/auth/action-guards"

export async function getStats() {
  const acces = await requireActionPermission("statistiques", "Vous n'avez pas la permission de consulter les statistiques.")
  if (!acces.ok) return { error: acces.error }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }

  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [etudesRes, missionsRes, candidaturesRes] = await Promise.all([
    supabase.from("etudes").select("id, type, budget_ht, budget, statut, created_at"),
    supabase.from("missions").select("id, nb_jeh, remuneration, taux_jour, nb_intervenants, statut, created_at"),
    supabase.from("candidatures").select("id, personne_id, statut, created_at"),
  ])

  const etudes = etudesRes.data ?? []
  const missions = missionsRes.data ?? []
  const candidatures = candidaturesRes.data ?? []

  const etudesParType = {
    ao: etudes.filter(e => e.type === "ao").length,
    cs: etudes.filter(e => e.type === "cs").length,
    prospection: etudes.filter(e => e.type === "prospection").length,
  }

  // "Réalisé" = études terminées (facturation acquise) ; "prévisionnel" =
  // études encore en cours ou signées (budget attendu, pas encore acquis).
  // Avant correctif, "en_cours" était compté dans les deux totaux à la fois
  // (double comptage), donnant un CA global supérieur à la somme réelle des
  // budgets des études — cf. audit du 2026-09-07.
  const caRealise = etudes
    .filter(e => e.statut === "terminee")
    .reduce((sum, e) => sum + Number(e.budget_ht ?? e.budget ?? 0), 0)

  const caPrevisionnel = etudes
    .filter(e => ["signee", "en_cours", "en_cours_prospection"].includes(e.statut))
    .reduce((sum, e) => sum + Number(e.budget_ht ?? e.budget ?? 0), 0)

  const totalJeh = missions.reduce((sum, m) => sum + jehTotalMission(m), 0)
  const retributionTotal = missions.reduce((sum, m) => sum + montantTotalMission(m), 0)

  const candidaturesAcceptees = candidatures.filter(c => c.statut === "acceptee")
  
  const intervenantsUniques = new Set(
    candidaturesAcceptees.filter(c => c.personne_id).map(c => c.personne_id)
  ).size

  const candidaturesMois = candidatures.filter(c => c.created_at >= firstOfMonth).length

  return {
    data: {
      nbEtudes: etudes.length,
      nbMissions: missions.length,
      nbIntervenants: intervenantsUniques,
      candidaturesMois,
      etudesParType,
      caRealise,
      caPrevisionnel,
      totalJeh,
      retributionTotal,
    },
  }
}
