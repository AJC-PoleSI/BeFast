"use client"

import { useEffect, useState } from "react"
import { getMissions } from "@/lib/actions/missions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Search, Plus, Filter } from "lucide-react"
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

export default function MissionsPage() {
  const [missions, setMissions] = useState<MissionWithEtude[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<FilterState>({})
  const [activeFilters, setActiveFilters] = useState<FilterState>({})

  useEffect(() => {
    const loadMissions = async () => {
      setLoading(true)
      const result = await getMissions(activeFilters)
      if (result.data) {
        setMissions(result.data)
      }
      setLoading(false)
    }
    loadMissions()
  }, [activeFilters])

  const handleSearch = (search: string) => {
    setFilters({ ...filters, search })
  }

  const handleFilterChange = (key: string, value: string | undefined) => {
    setFilters({ ...filters, [key]: value })
  }

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

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-navy">Missions</h1>
          <p className="text-muted-foreground mt-1">
            Découvrez et candidatez aux missions disponibles
          </p>
        </div>
        <Button className="w-full sm:w-auto bg-navy hover:bg-navy/90 gap-2">
          <Plus size={18} />
          Nouvelle mission
        </Button>
      </div>

      {/* Search & Filters */}
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Filtrer les missions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Rechercher une mission..."
                className="pl-10"
                value={filters.search || ""}
                onChange={(e) => handleSearch(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-navy">Type</label>
                <select
                  className="w-full px-3 py-2 border border-border rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
                  value={filters.type || ""}
                  onChange={(e) => handleFilterChange("type", e.target.value || undefined)}
                >
                  <option value="">Tous les types</option>
                  {MISSION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-navy">Voie</label>
                <select
                  className="w-full px-3 py-2 border border-border rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
                  value={filters.voie || ""}
                  onChange={(e) => handleFilterChange("voie", e.target.value || undefined)}
                >
                  <option value="">Toutes les voies</option>
                  {VOIES.map((voie) => (
                    <option key={voie.value} value={voie.value}>
                      {voie.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-navy">Classe</label>
                <select
                  className="w-full px-3 py-2 border border-border rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
                  value={filters.classe || ""}
                  onChange={(e) => handleFilterChange("classe", e.target.value || undefined)}
                >
                  <option value="">Toutes les classes</option>
                  {CLASSES.map((classe) => (
                    <option key={classe.value} value={classe.value}>
                      {classe.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={applyFilters}
                className="flex-1 bg-gold hover:bg-gold/90 text-navy gap-2"
              >
                <Filter size={16} />
                Appliquer
              </Button>
              <Button
                onClick={resetFilters}
                variant="outline"
                className="flex-1"
              >
                Réinitialiser
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-80 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {/* Featured Mission */}
          {filteredMissions.length > 0 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMissions.map((mission) => (
                  <Card
                    key={mission.id}
                    className="border-border shadow-sm hover:shadow-md hover:border-gold/30 transition-all cursor-pointer"
                  >
                    <CardContent className="p-6">
                      <div className="space-y-4">
                        <div>
                          <h3 className="font-heading font-semibold text-navy text-lg">
                            {mission.nom}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                            {mission.description}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {mission.type && (
                            <Badge variant="outline" className="text-xs">
                              {mission.type === "chef_projet"
                                ? "Chef de projet"
                                : "Intervenant"}
                            </Badge>
                          )}
                          {mission.voie && (
                            <Badge variant="secondary" className="text-xs">
                              {mission.voie}
                            </Badge>
                          )}
                          {mission.classe && (
                            <Badge
                              variant="outline"
                              className="text-xs border-gold/30"
                            >
                              {mission.classe}
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-4 border-t border-border">
                          {mission.remuneration && (
                            <div>
                              <p className="text-xs text-muted-foreground">
                                Budget
                              </p>
                              <p className="text-sm font-semibold text-gold">
                                €{mission.remuneration.toLocaleString()}
                              </p>
                            </div>
                          )}
                          <div>
                            <p className="text-xs text-muted-foreground">JEH</p>
                            <p className="text-sm font-semibold text-navy">
                              {mission.nb_jeh}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Postes
                            </p>
                            <p className="text-sm font-semibold text-navy">
                              {mission.nb_intervenants}
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {filteredMissions.length === 0 && (
            <Card className="border-border border-dashed py-12">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <div className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center mb-4">
                  <Filter className="h-6 w-6 text-gold" />
                </div>
                <h3 className="font-heading font-semibold text-navy mb-2">
                  Aucune mission trouvée
                </h3>
                <p className="text-muted-foreground max-w-sm">
                  Essayez de modifier vos critères de recherche ou de filtrage pour
                  trouver des missions adaptées.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
