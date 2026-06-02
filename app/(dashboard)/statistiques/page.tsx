import { TrendingUp } from "lucide-react"
import { getStats } from "@/lib/actions/stats"
import { StatistiquesClient, type StatsData } from "./statistiques-client"

export const metadata = {
  title: "Statistiques",
}

export default async function StatistiquesPage() {
  // Récupération côté serveur : les données sont prêtes au 1er rendu,
  // plus de round-trip client après hydratation. Le skeleton (loading.tsx)
  // s'affiche pendant cette attente serveur.
  const res = await getStats()
  const stats = (res?.data as StatsData | undefined) ?? null

  if (!stats) {
    return (
      <div className="p-8 space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#00236f] flex items-center justify-center shadow-md shadow-[#00236f]/20">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-manrope font-black text-[#00236f]">Statistiques</h1>
            <p className="text-zinc-500 text-sm">Vue d&apos;ensemble de l&apos;activité et de la trésorerie.</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-10 text-center">
          <p className="text-sm text-zinc-500">Impossible de charger les statistiques pour le moment.</p>
        </div>
      </div>
    )
  }

  return <StatistiquesClient stats={stats} />
}
