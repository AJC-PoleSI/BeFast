"use client"

import { Users, TrendingUp, TrendingDown, PiggyBank, Briefcase } from "lucide-react"

export default function AdminStatsDashboard() {
  const Kpis = [
    {
      title: "Chiffre d'Affaires Réalisé",
      value: "42 500 €",
      trend: "+12%",
      trendUp: true,
      icon: PiggyBank,
      color: "text-[#00236f]"
    },
    {
      title: "CA Prévisionnel Restant",
      value: "18 200 €",
      trend: "-3%",
      trendUp: false,
      icon: TrendingUp,
      color: "text-slate-600"
    },
    {
      title: "Intervenants Actifs",
      value: "134",
      trend: "+5 ce mois",
      trendUp: true,
      icon: Users,
      color: "text-[#1e3a8a]"
    },
    {
      title: "Missions en Cours",
      value: "12",
      trend: "+2",
      trendUp: true,
      icon: Briefcase,
      color: "text-[#00236f]"
    }
  ]

  const ClientTypes = [
    { label: "Appels d'Offres & Marchés Publics", pct: 45, value: "19 125 €", color: "bg-[#00236f]" },
    { label: "Clients Sortants", pct: 30, value: "12 750 €", color: "bg-[#1e3a8a]" },
    { label: "Prospection Directe", pct: 25, value: "10 625 €", color: "bg-[#d0d8ff]" },
  ]

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-manrope font-black text-[#00236f]">Statistiques & Trésorerie</h1>
        <p className="text-slate-500 text-sm mt-1">Vue globale sur les performances et la santé financière de la Junior.</p>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Kpis.map((kpi, idx) => {
          const Icon = kpi.icon
          return (
            <div key={idx} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start mb-4">
                <div className={`p-2.5 bg-slate-50 rounded-lg ${kpi.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                {kpi.trend && (
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                    kpi.trendUp ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
                  }`}>
                    {kpi.trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {kpi.trend}
                  </span>
                )}
              </div>
              <div>
                <p className="text-3xl font-manrope font-black text-slate-800 tracking-tight">{kpi.value}</p>
                <p className="text-sm text-slate-500 font-medium mt-1">{kpi.title}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* GRAPHE RÉPARTITION CLIENTS */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col">
          <h2 className="font-bold text-slate-800 mb-6">Répartition par canal d'acquisition (CA)</h2>
          
          <div className="flex-1 flex flex-col justify-center space-y-6">
            {ClientTypes.map((type, idx) => (
              <div key={idx} className="group">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <span className="text-sm font-semibold text-slate-700">{type.label}</span>
                    <span className="text-xs text-slate-400 ml-2">({type.pct}%)</span>
                  </div>
                  <span className="text-sm font-bold text-slate-900">{type.value}</span>
                </div>
                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full ${type.color} group-hover:opacity-90 transition-opacity`}
                    style={{ width: `${type.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* TRESORERIE SIDE WIDGET */}
        <div className="bg-[#00236f] rounded-xl border border-[#1e3a8a] shadow-sm p-6 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <PiggyBank className="w-32 h-32" />
          </div>
          
          <h2 className="font-bold mb-6 text-blue-100">Solde Bancaire Estimé</h2>
          
          <div className="mb-8">
            <p className="text-5xl font-manrope font-black">84 120 €</p>
            <p className="text-sm text-blue-200 mt-2">Dernier rapprochement : Aujourd'hui, 09:00</p>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-white/10">
              <span className="text-sm text-blue-100">Frais de structure provisionnés</span>
              <span className="font-bold">12 000 €</span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-white/10">
              <span className="text-sm text-blue-100">Rémunérations en attente</span>
              <span className="font-bold">8 500 €</span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-sm font-semibold text-white">Disponibilité nette</span>
              <span className="font-black text-emerald-400">63 620 €</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
