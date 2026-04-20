"use client"

import { useEffect, useState } from "react"
import { Users, PiggyBank, Briefcase, School, FileText, Euro, Clock, Loader2 } from "lucide-react"
import { getStats } from "@/lib/actions/stats"

export default function AdminStatsDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getStats().then(res => {
      if (res.data) setStats(res.data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#00236f]" />
      </div>
    )
  }

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n)
  const fmtEur = (n: number) => `${fmt(Math.round(n))} €`

  const kpis = [
    { icon: PiggyBank, title: "CA Réalisé", value: fmtEur(stats.caRealise), color: "emerald" },
    { icon: Euro, title: "CA Prévisionnel", value: fmtEur(stats.caPrevisionnel), color: "blue" },
    { icon: Briefcase, title: "Études", value: fmt(stats.nbEtudes), color: "purple" },
    { icon: FileText, title: "Missions", value: fmt(stats.nbMissions), color: "amber" },
    { icon: Users, title: "Intervenants uniques", value: fmt(stats.nbIntervenants), color: "sky" },
    { icon: Clock, title: "JEH total", value: fmt(stats.totalJeh), color: "rose" },
    { icon: Euro, title: "Rétribution versée", value: fmtEur(stats.retributionTotal), color: "indigo" },
    { icon: School, title: "Candidatures ce mois", value: fmt(stats.candidaturesMois), color: "teal" },
  ]

  const COLOR_MAP: Record<string, string> = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    teal: "bg-teal-50 text-teal-700 border-teal-200",
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-manrope font-black text-[#00236f]">Statistiques</h1>
        <p className="text-slate-500 text-sm mt-1">Vue d'ensemble de l'activité et de la trésorerie.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.title} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${COLOR_MAP[k.color]}`}>
                <k.icon className="w-5 h-5" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{k.title}</p>
            </div>
            <p className="text-2xl font-manrope font-black text-[#00236f]">{k.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-manrope font-bold text-[#00236f] mb-4">Répartition des études par type</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
            <p className="text-xs font-semibold text-blue-700 uppercase">Appel d'offres</p>
            <p className="text-3xl font-manrope font-black text-blue-900 mt-1">{stats.etudesParType.ao}</p>
          </div>
          <div className="p-4 rounded-lg bg-purple-50 border border-purple-200">
            <p className="text-xs font-semibold text-purple-700 uppercase">Contact spontané</p>
            <p className="text-3xl font-manrope font-black text-purple-900 mt-1">{stats.etudesParType.cs}</p>
          </div>
          <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
            <p className="text-xs font-semibold text-amber-700 uppercase">Prospection</p>
            <p className="text-3xl font-manrope font-black text-amber-900 mt-1">{stats.etudesParType.prospection}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
