"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { unstable_cache } from "next/cache"
import { ETUDES_TAG, MISSIONS_TAG } from "@/lib/cache-tags"

const STATS_TAG = "stats"

const _getStatsCached = unstable_cache(
  async () => {
    const supabase = createAdminClient()
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    let etudesRes = await supabase.from("etudes").select("id, type, budget_ht, budget, statut, created_at")
    if (
      etudesRes.error &&
      (etudesRes.error.code === "42703" || /column.*budget.*does not exist/i.test(etudesRes.error.message))
    ) {
      etudesRes = await supabase.from("etudes").select("id, type, budget_ht, statut, created_at") as any
    }

    const [missionsRes, candidaturesRes] = await Promise.all([
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

    const totalJeh = missions.reduce(
      (sum, m) => sum + Number(m.nb_jeh ?? 0) * Number(m.nb_intervenants ?? 1), 0
    )
    const retributionTotal = missions.reduce(
      (sum, m) => sum + Number(m.nb_jeh ?? 0) * Number(m.nb_intervenants ?? 1) * Number(m.remuneration ?? 0), 0
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
  },
  [STATS_TAG],
  { tags: [STATS_TAG, ETUDES_TAG, MISSIONS_TAG], revalidate: 60 }
)

export async function getStats() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Non authentifié" }
  return _getStatsCached()
}
