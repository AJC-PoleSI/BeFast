"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import type { MissionWithEtude } from "@/types/database.types"

const MISSION_TYPES = [{ value: "intervenant", label: "Intervenant" }]
const typeLabel = (_t?: string | null) => "Intervenant"
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

interface FilterState {
  type?: string
  voie?: string
  classe?: string
  search?: string
}

export function MissionsClient({ initialMissions }: { initialMissions: MissionWithEtude[] }) {
  const [filters, setFilters] = useState<FilterState>({})

  // Tout le filtrage est fait côté client à partir des données déjà fournies.
  // Plus de re-fetch — instantané.
  const filteredMissions = useMemo(() => {
    return initialMissions.filter((m) => {
      if (filters.type && m.type !== filters.type) return false
      if (filters.voie && m.voie !== filters.voie) return false
      if (filters.classe && m.classe !== filters.classe) return false
      if (filters.search) {
        const s = filters.search.toLowerCase()
        const matches =
          m.nom.toLowerCase().includes(s) ||
          (m.description?.toLowerCase().includes(s) ?? false)
        if (!matches) return false
      }
      return true
    })
  }, [initialMissions, filters])

  const handleSearch = (search: string) => setFilters((f) => ({ ...f, search }))
  const handleFilterChange = (key: string, value: string | undefined) =>
    setFilters((f) => ({ ...f, [key]: value }))
  const resetFilters = () => setFilters({})

  const featured = filteredMissions[0]
  const secondary = filteredMissions[1]
  const rest = filteredMissions.slice(2, 5)

  return (
    <>
      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-lg">search</span>
            <input
              type="search"
              placeholder="Rechercher une mission..."
              className="w-full h-10 pl-9 pr-4 rounded-lg border border-zinc-200 text-sm text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 bg-zinc-50"
              value={filters.search || ""}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          <select
            className="h-10 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
            value={filters.type || ""}
            onChange={(e) => handleFilterChange("type", e.target.value || undefined)}
          >
            <option value="">Tous types</option>
            {MISSION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          <select
            className="h-10 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
            value={filters.voie || ""}
            onChange={(e) => handleFilterChange("voie", e.target.value || undefined)}
          >
            <option value="">Toutes voies</option>
            {VOIES.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>

          <select
            className="h-10 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-600 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
            value={filters.classe || ""}
            onChange={(e) => handleFilterChange("classe", e.target.value || undefined)}
          >
            <option value="">Toutes classes</option>
            {CLASSES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>

          <button
            onClick={resetFilters}
            className="h-10 px-4 rounded-lg border border-zinc-200 bg-white text-sm text-zinc-600 hover:bg-zinc-50 transition-colors"
          >
            Réinitialiser
          </button>
        </div>
      </div>

      {filteredMissions.length === 0 ? (
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
          {(featured || secondary) && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {featured && (
                <Link href={`/missions/${featured.id}`} className="lg:col-span-8">
                  <div className="bg-white rounded-xl border border-zinc-200 shadow-sm hover:shadow-md hover:border-[#00236f]/30 transition-all p-6 h-full cursor-pointer">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex flex-wrap gap-2 mb-3">
                          {featured.type && (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[featured.type] || "bg-zinc-100 text-zinc-600"}`}>
                              {typeLabel(featured.type)}
                            </span>
                          )}
                          {featured.voie && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                              {featured.voie}
                            </span>
                          )}
                        </div>
                        <h2 className="text-xl font-manrope font-black text-[#00236f] mb-2">{featured.nom}</h2>
                        <p className="text-sm text-zinc-500 line-clamp-3">{featured.description}</p>
                      </div>
                      <div className="w-14 h-14 rounded-xl bg-[#d0d8ff] flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[#00236f] text-2xl">assignment</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 pt-4 border-t border-zinc-100">
                      {featured.remuneration && (
                        <div>
                          <p className="text-xs text-zinc-400">Budget</p>
                          <p className="text-lg font-manrope font-black text-[#00236f]">€{featured.remuneration.toLocaleString()}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-zinc-400">JEH</p>
                        <p className="text-lg font-manrope font-black text-[#00236f]">{featured.nb_jeh}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-400">Postes</p>
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
                  <div className="bg-white rounded-xl border border-zinc-200 shadow-sm hover:shadow-md hover:border-[#00236f]/30 transition-all p-5 h-full cursor-pointer flex flex-col">
                    <div className="flex-1">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {secondary.type && (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[secondary.type] || "bg-zinc-100 text-zinc-600"}`}>
                            {typeLabel(secondary.type)}
                          </span>
                        )}
                      </div>
                      <h3 className="font-manrope font-bold text-[#00236f] text-base mb-2">{secondary.nom}</h3>
                      <p className="text-sm text-zinc-500 line-clamp-3">{secondary.description}</p>
                    </div>
                    <div className="flex items-center gap-4 pt-4 border-t border-zinc-100 mt-4">
                      {secondary.remuneration && (
                        <p className="text-base font-manrope font-black text-[#00236f]">€{secondary.remuneration.toLocaleString()}</p>
                      )}
                      <p className="text-sm text-zinc-500">{secondary.nb_jeh} JEH</p>
                    </div>
                  </div>
                </Link>
              )}
            </div>
          )}

          {rest.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rest.map((mission) => (
                <Link key={mission.id} href={`/missions/${mission.id}`}>
                  <div className="bg-white rounded-xl border border-zinc-200 shadow-sm hover:shadow-md hover:border-[#00236f]/30 transition-all p-5 cursor-pointer h-full">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {mission.type && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[mission.type] || "bg-zinc-100 text-zinc-600"}`}>
                          {typeLabel(mission.type)}
                        </span>
                      )}
                      {mission.voie && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">{mission.voie}</span>
                      )}
                    </div>
                    <h3 className="font-manrope font-bold text-[#00236f] text-sm mb-1.5">{mission.nom}</h3>
                    <p className="text-xs text-zinc-500 line-clamp-2 mb-4">{mission.description}</p>
                    <div className="flex items-center gap-3 pt-3 border-t border-zinc-100">
                      {mission.remuneration && (
                        <p className="text-sm font-bold text-[#00236f]">€{mission.remuneration.toLocaleString()}</p>
                      )}
                      <p className="text-xs text-zinc-400">{mission.nb_jeh} JEH</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}

          <div className="bg-[#00236f] rounded-xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-white">
            <div>
              <h3 className="font-manrope font-black text-lg mb-1">Vous ne trouvez pas votre mission ?</h3>
              <p className="text-blue-200 text-sm">Contactez l&apos;équipe pour des opportunités sur mesure.</p>
            </div>
            <a
              href="mailto:contact@befast.fr"
              className="shrink-0 px-5 py-2.5 rounded-xl bg-white text-[#00236f] text-sm font-semibold hover:bg-blue-50 transition-colors flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-lg">mail</span>
              Nous contacter
            </a>
          </div>

          {filteredMissions.length > 5 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMissions.slice(5).map((mission) => (
                <Link key={mission.id} href={`/missions/${mission.id}`}>
                  <div className="bg-white rounded-xl border border-zinc-200 shadow-sm hover:shadow-md hover:border-[#00236f]/30 transition-all p-5 cursor-pointer h-full">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {mission.type && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[mission.type] || "bg-zinc-100 text-zinc-600"}`}>
                          {typeLabel(mission.type)}
                        </span>
                      )}
                    </div>
                    <h3 className="font-manrope font-bold text-[#00236f] text-sm mb-1.5">{mission.nom}</h3>
                    <p className="text-xs text-zinc-500 line-clamp-2 mb-4">{mission.description}</p>
                    <div className="flex items-center gap-3 pt-3 border-t border-zinc-100">
                      {mission.remuneration && (
                        <p className="text-sm font-bold text-[#00236f]">€{mission.remuneration.toLocaleString()}</p>
                      )}
                      <p className="text-xs text-zinc-400">{mission.nb_jeh} JEH</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
