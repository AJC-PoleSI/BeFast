"use client"

import { useEffect, useState } from "react"
import { getMissions } from "@/lib/actions/missions"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { useUser } from "@/hooks/useUser"
import { AlertCircle, ShieldAlert } from "lucide-react"
import Link from "next/link"
import type { MissionWithEtude } from "@/types/database.types"

interface FilterState {
  type?: string
  voie?: string
  classe?: string
  search?: string
}

const MISSION_TYPES = [
  { value: "chef_projet", label: "Chef de projet" },
  { value: "intervenant", label: "Intervenant" },
]

const VOIES = [
  { value: "finance", label: "Finance" },
  { value: "marketing", label: "Marketing" },
  { value: "audit", label: "Audit" },
  { value: "rse", label: "RSE" },
]

const CLASSES = [
  { value: "premaster", label: "Prémaster" },
  { value: "m1", label: "M1" },
  { value: "m2", label: "M2" },
]

const TYPE_COLORS: Record<string, string> = {
  chef_projet: "bg-[#d0d8ff] text-[#00236f]",
  intervenant: "bg-purple-100 text-purple-700",
}

export default function MissionsPage() {
  const { profile, loading: userLoading } = useUser()
  const [missions, setMissions] = useState<MissionWithEtude[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterState>({})
  const [activeFilters, setActiveFilters] = useState<FilterState>({})

  useEffect(() => {
    if (profile?.account_status !== "validated") return

    const loadMissions = async () => {
      setLoading(true)
      const result = await getMissions(activeFilters)
      if (result.data) setMissions(result.data)
      setLoading(false)
    }
    loadMissions()
  }, [activeFilters, profile?.account_status])

  if (userLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    )
  }

  if (profile?.account_status !== "validated") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4 text-amber-600">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-manrope font-black text-[#00236f] mb-2">Accès restreint</h2>
        <p className="text-slate-500 max-w-md mx-auto mb-6">
          Votre compte est en cours de validation par l'administration. 
          L'accès au catalogue des missions sera disponible une fois votre profil validé.
        </p>
        <Link href="/documents">
          <Button className="bg-[#00236f] hover:bg-[#1e3a8a] text-white rounded-xl px-6">
            Vérifier mes documents
          </Button>
        </Link>
      </div>
    )
  }

  const handleSearch = (search: string) => setFilters({ ...filters, search })
  const handleFilterChange = (key: string, value: string | undefined) =>
    setFilters({ ...filters, [key]: value })

  const applyFilters = () => {
    const newFilters: FilterState = {}
    if (filters.type) newFilters.type = filters.type
    if (filters.voie) newFilters.voie = filters.voie
    if (filters.classe) newFilters.classe = filters.classe
    setActiveFilters(newFilters)
  }

  const resetFilters = () => {
    setFilters({})
    setActiveFilters({})
  }

  const filteredMissions = filters.search
    ? missions.filter(
        (m) =>
          m.nom.toLowerCase().includes(filters.search!.toLowerCase()) ||
          m.description?.toLowerCase().includes(filters.search!.toLowerCase())
      )
    : missions

  const featured = filteredMissions[0]
  const secondary = filteredMissions[1]
  const rest = filteredMissions.slice(2, 5)

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">
            Mission Catalog
          </p>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Missions</h1>
          <p className="text-sm text-slate-500 mt-0.5">Découvrez et candidatez aux missions disponibles</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
            <input
              type="search"
              placeholder="Rechercher une mission..."
              className="w-full h-10 pl-9 pr-4 rounded-lg border border-slate-200 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 bg-slate-50"
              value={filters.search || ""}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          {/* Type */}
          <select
            className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
            value={filters.type || ""}
            onChange={(e) => handleFilterChange("type", e.target.value || undefined)}
          >
            <option value="">Tous types</option>
            {MISSION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          {/* Voie */}
          <select
            className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
            value={filters.voie || ""}
            onChange={(e) => handleFilterChange("voie", e.target.value || undefined)}
          >
            <option value="">Toutes voies</option>
            {VOIES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>

          {/* Classe */}
          <select
            className="h-10 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
            value={filters.classe || ""}
            onChange={(e) => handleFilterChange("classe", e.target.value || undefined)}
          >
            <option value="">Toutes classes</option>
            {CLASSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>

          <button
            onClick={applyFilters}
            className="h-10 px-5 rounded-lg bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">filter_list</span>
            Filtrer
          </button>
          <button
            onClick={resetFilters}
            className="h-10 px-4 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 transition-colors"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-72 w-full rounded-xl" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        </div>
      ) : filteredMissions.length === 0 ? (
        /* No results */
        <div className="bg-[#00236f] rounded-xl p-10 text-white text-center">
          <span className="material-symbols-outlined text-5xl text-[#d0d8ff] mb-3 block">search_off</span>
          <h3 className="font-manrope font-black text-xl mb-2">Aucune mission trouvée</h3>
          <p className="text-blue-200 text-sm max-w-sm mx-auto">Essayez de modifier vos critères de recherche ou de filtrage.</p>
          <button
            onClick={resetFilters}
            className="mt-4 px-5 py-2.5 rounded-xl bg-white text-[#00236f] font-semibold text-sm hover:bg-blue-50 transition-colors"
          >
            Voir toutes les missions
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Bento row 1: featured (col-8) + secondary (col-4) */}
          {(featured || secondary) && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {featured && (
                <Link href={`/missions/${featured.id}`} className="lg:col-span-8">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[#00236f]/30 transition-all p-6 h-full cursor-pointer">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-2 mb-3">
                          {featured.type && (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[featured.type] || "bg-slate-100 text-slate-600"}`}>
                              {featured.type === "chef_projet" ? "Chef de projet" : "Intervenant"}
                            </span>
                          )}
                          {featured.voie && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                              {featured.voie}
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl font-manrope font-black text-[#00236f] mb-2">{featured.nom}</h2>
                        <p className="text-sm text-slate-500 line-clamp-3">{featured.description}</p>
                      </div>
                      <div className="w-14 h-14 rounded-xl bg-[#d0d8ff] flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[#00236f] text-2xl">assignment</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 pt-4 border-t border-slate-100">
                      {featured.remuneration && (
                        <div>
                          <p className="text-xs text-slate-400">Budget</p>
                          <p className="text-lg font-manrope font-black text-[#00236f]">€{featured.remuneration.toLocaleString()}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-slate-400">JEH</p>
                        <p className="text-lg font-manrope font-black text-[#00236f]">{featured.nb_jeh}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Postes</p>
                        <p className="text-lg font-manrope font-black text-[#00236f]">{featured.nb_intervenants}</p>
                      </div>
                      <div className="ml-auto">
                        <span className="flex items-center gap-1 px-4 py-2 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors">
                          Candidater
                          <span className="material-symbols-outlined text-lg">arrow_forward</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              )}

              {secondary && (
                <Link href={`/missions/${secondary.id}`} className="lg:col-span-4">
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[#00236f]/30 transition-all p-5 h-full cursor-pointer flex flex-col">
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {secondary.type && (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[secondary.type] || "bg-slate-100 text-slate-600"}`}>
                            {secondary.type === "chef_projet" ? "Chef de projet" : "Intervenant"}
                          </span>
                        )}
                      </div>
                      <h3 className="font-manrope font-bold text-[#00236f] text-base mb-2">{secondary.nom}</h3>
                      <p className="text-sm text-slate-500 line-clamp-3">{secondary.description}</p>
                    </div>
                    <div className="flex items-center gap-4 pt-4 border-t border-slate-100 mt-4">
                      {secondary.remuneration && (
                        <p className="text-base font-manrope font-black text-[#00236f]">€{secondary.remuneration.toLocaleString()}</p>
                      )}
                      <p className="text-sm text-slate-500">{secondary.nb_jeh} JEH</p>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          )}

          {/* Row of 3 smaller cards */}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rest.map((mission) => (
                <Link key={mission.id} href={`/missions/${mission.id}`}>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[#00236f]/30 transition-all p-5 cursor-pointer h-full">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {mission.type && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[mission.type] || "bg-slate-100 text-slate-600"}`}>
                          {mission.type === "chef_projet" ? "Chef de projet" : "Intervenant"}
                        </span>
                      )}
                      {mission.voie && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">{mission.voie}</span>
                      )}
                    </div>
                    <h3 className="font-manrope font-bold text-[#00236f] text-sm mb-1.5">{mission.nom}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-4">{mission.description}</p>
                    <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                      {mission.remuneration && (
                        <p className="text-sm font-bold text-[#00236f]">€{mission.remuneration.toLocaleString()}</p>
                      )}
                      <p className="text-xs text-slate-400">{mission.nb_jeh} JEH</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* CTA navy card */}
          <div className="bg-[#00236f] rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-white">
            <div>
              <h3 className="font-manrope font-black text-lg mb-1">Vous ne trouvez pas votre mission ?</h3>
              <p className="text-blue-200 text-sm">Contactez l'équipe pour des opportunités sur mesure.</p>
            </div>
            <a
              href="mailto:contact@befast.fr"
              className="shrink-0 px-5 py-2.5 rounded-xl bg-white text-[#00236f] text-sm font-semibold hover:bg-blue-50 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">mail</span>
              Nous contacter
            </a>
          </div>

          {/* Remaining missions beyond first 5 */}
          {filteredMissions.length > 5 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMissions.slice(5).map((mission) => (
                <Link key={mission.id} href={`/missions/${mission.id}`}>
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-[#00236f]/30 transition-all p-5 cursor-pointer h-full">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {mission.type && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[mission.type] || "bg-slate-100 text-slate-600"}`}>
                          {mission.type === "chef_projet" ? "Chef de projet" : "Intervenant"}
                        </span>
                      )}
                    </div>
                    <h3 className="font-manrope font-bold text-[#00236f] text-sm mb-1.5">{mission.nom}</h3>
                    <p className="text-xs text-slate-500 line-clamp-2 mb-4">{mission.description}</p>
                    <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                      {mission.remuneration && (
                        <p className="text-sm font-bold text-[#00236f]">€{mission.remuneration.toLocaleString()}</p>
                      )}
                      <p className="text-xs text-slate-400">{mission.nb_jeh} JEH</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
