"use server"

import { createClient } from "@/lib/supabase/server"

export async function getStats() {
  const supabase = createClient()
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [etudesRes, missionsRes, candidaturesRes] = await Promise.all([
    supabase.from("etudes").select("id, type, budget_ht, budget, statut, created_at"),
    supabase.from("missions").select("id, nb_jeh, remuneration, nb_intervenants, statut, created_at"),
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

  const caRealise = etudes
    .filter(e => e.statut === "terminee" || e.statut === "en_cours")
    .reduce((sum, e) => sum + Number(e.budget_ht ?? e.budget ?? 0), 0)

  const caPrevisionnel = etudes
    .filter(e => ["signee", "en_cours", "en_cours_prospection"].includes(e.statut))
    .reduce((sum, e) => sum + Number(e.budget_ht ?? e.budget ?? 0), 0)

  const totalJeh = missions.reduce((sum, m) => sum + Number(m.nb_jeh ?? 0) * Number(m.nb_intervenants ?? 1), 0)
  const retributionTotal = missions.reduce(
    (sum, m) => sum + Number(m.nb_jeh ?? 0) * Number(m.nb_intervenants ?? 1) * Number(m.remuneration ?? 0),
    0
  )

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
