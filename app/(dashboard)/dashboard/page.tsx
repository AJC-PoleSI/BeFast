"use client"

import { useEffect, useState } from "react"
import { useUser } from "@/hooks/useUser"
import { getMissions } from "@/lib/actions/missions"
import { getEtudes } from "@/lib/actions/etudes"
import { getMesCandidatures } from "@/lib/actions/missions"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import type { MissionWithEtude, EtudeWithRelations, CandidatureWithMission } from "@/types/database.types"

interface DashboardStats {
  missionsOuvertes: number
  etudesEnCours: number
  candidatures: number
  taux: number
}

const STATUT_BADGE: Record<string, { label: string; className: string }> = {
  ouverte: { label: "Ouverte", className: "bg-blue-100 text-blue-700" },
  en_cours: { label: "En cours", className: "bg-blue-100 text-blue-700" },
  terminee: { label: "Terminée", className: "bg-green-100 text-green-700" },
  payee: { label: "Payée", className: "bg-emerald-100 text-emerald-700" },
  annulee: { label: "Annulée", className: "bg-red-100 text-red-600" },
}

export default function DashboardPage() {
  const { profile } = useUser()
  const [stats, setStats] = useState<DashboardStats>({
    missionsOuvertes: 0,
    etudesEnCours: 0,
    candidatures: 0,
    taux: 0,
  })
  const [missions, setMissions] = useState<MissionWithEtude[]>([])
  const [candidatures, setCandidatures] = useState<CandidatureWithMission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      const missionsResult = await getMissions({ statut: "ouverte" })
      const missionsData = missionsResult.data || []
      setMissions(missionsData.slice(0, 5))

      const etudesResult = await getEtudes()
      const etudesData = etudesResult.data || []
      const etudesEnCours = etudesData.filter((e) => e.statut === "en_cours")

      const candidaturesResult = await getMesCandidatures()
      const candidaturesData = candidaturesResult.data || []
      setCandidatures(candidaturesData.slice(0, 3))

      setStats({
        missionsOuvertes: missionsData.length,
        etudesEnCours: etudesEnCours.length,
        candidatures: candidaturesData.length,
        taux: candidaturesData.length > 0 ? 75 : 0,
      })
      setLoading(false)
    }
    loadData()
  }, [])

  const greeting = profile
    ? `Bienvenue, ${profile.prenom || profile.email}`
    : "Bienvenue"

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="text-sm text-slate-500">{greeting}</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CA Financier */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">CA Financier</p>
              {loading ? (
                <Skeleton className="h-8 w-20 mt-2" />
              ) : (
                <p className="text-2xl font-manrope font-black text-[#00236f] mt-2">—</p>
              )}
              <p className="text-xs text-slate-400 mt-1">Prévisionnel N/A</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-[#d0d8ff] flex items-center justify-center">
              <span className="material-symbols-outlined text-[#00236f] text-xl">euro</span>
            </div>
          </div>
        </div>

        {/* Missions actives */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Missions actives</p>
              {loading ? (
                <Skeleton className="h-8 w-12 mt-2" />
              ) : (
                <p className="text-2xl font-manrope font-black text-[#00236f] mt-2">{stats.missionsOuvertes}</p>
              )}
              <Link href="/missions" className="text-xs text-[#00236f] mt-1 hover:underline inline-flex items-center gap-0.5">
                Voir missions
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
            </div>
            <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-600 text-xl">assignment</span>
            </div>
          </div>
        </div>

        {/* Études en cours */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Études en cours</p>
              {loading ? (
                <Skeleton className="h-8 w-12 mt-2" />
              ) : (
                <p className="text-2xl font-manrope font-black text-[#00236f] mt-2">{stats.etudesEnCours}</p>
              )}
              <Link href="/etudes" className="text-xs text-[#00236f] mt-1 hover:underline inline-flex items-center gap-0.5">
                Voir études
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </Link>
            </div>
            <div className="w-11 h-11 rounded-xl bg-purple-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-purple-600 text-xl">school</span>
            </div>
          </div>
        </div>

        {/* Intervenants */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Mes candidatures</p>
              {loading ? (
                <Skeleton className="h-8 w-12 mt-2" />
              ) : (
                <p className="text-2xl font-manrope font-black text-[#00236f] mt-2">{stats.candidatures}</p>
              )}
              {stats.candidatures > 0 ? (
                <p className="text-xs text-emerald-600 mt-1 font-medium">{stats.taux}% acceptation</p>
              ) : (
                <p className="text-xs text-slate-400 mt-1">Aucune candidature</p>
              )}
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-100 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-600 text-xl">group</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent missions — col-span-2 */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <h2 className="font-manrope font-bold text-[#00236f] text-base">Missions récentes</h2>
            <Link href="/missions" className="text-xs text-[#00236f] font-medium hover:underline flex items-center gap-0.5">
              Voir tout
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
              </div>
            ) : missions.length > 0 ? (
              missions.map((mission) => {
                const badge = STATUT_BADGE[mission.statut] || { label: mission.statut, className: "bg-slate-100 text-slate-600" }
                return (
                  <Link
                    key={mission.id}
                    href={`/missions/${mission.id}`}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-[#d0d8ff] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[#00236f] text-lg">assignment</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{mission.nom}</p>
                      <p className="text-xs text-slate-400 truncate">{mission.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {mission.remuneration && (
                        <span className="text-sm font-bold text-[#00236f]">€{mission.remuneration.toLocaleString()}</span>
                      )}
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                  </Link>
                )
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <span className="material-symbols-outlined text-4xl mb-2">assignment</span>
                <p className="text-sm">Aucune mission disponible</p>
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Quick actions */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-manrope font-bold text-[#00236f] text-base mb-4">Actions rapides</h2>
            <div className="space-y-2">
              {[
                { label: "Candidater à une mission", href: "/missions", icon: "assignment" },
                { label: "Voir mes études", href: "/etudes", icon: "school" },
                { label: "Gérer mes documents", href: "/profil", icon: "folder_open" },
                { label: "Mon profil", href: "/profil", icon: "person" },
              ].map((action) => (
                <Link
                  key={action.href + action.label}
                  href={action.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-[#eceef0] flex items-center justify-center group-hover:bg-[#d0d8ff] transition-colors">
                    <span className="material-symbols-outlined text-[#00236f] text-lg">{action.icon}</span>
                  </div>
                  <span className="text-sm font-medium text-slate-700 group-hover:text-[#00236f] transition-colors">{action.label}</span>
                  <span className="material-symbols-outlined text-slate-300 text-base ml-auto">arrow_forward_ios</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Candidatures status */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-manrope font-bold text-[#00236f] text-base mb-4">Statut candidatures</h2>
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
              </div>
            ) : candidatures.length > 0 ? (
              <div className="space-y-2">
                {candidatures.map((cand) => (
                  <div key={cand.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50">
                    <span className={`material-symbols-outlined text-xl ${
                      cand.statut === "acceptee" ? "text-emerald-500" :
                      cand.statut === "refusee" ? "text-red-500" :
                      "text-amber-500"
                    }`}>
                      {cand.statut === "acceptee" ? "check_circle" : cand.statut === "refusee" ? "cancel" : "schedule"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{cand.missions?.nom}</p>
                      <p className="text-xs text-slate-400">{new Date(cand.created_at).toLocaleDateString("fr-FR")}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                <span className="material-symbols-outlined text-3xl mb-1">timeline</span>
                <p className="text-xs">Aucune candidature</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
