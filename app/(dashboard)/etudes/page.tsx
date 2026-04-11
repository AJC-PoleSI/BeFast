"use client"

import { useEffect, useState } from "react"
import { getEtudes } from "@/lib/actions/etudes"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Search, Plus, Calendar } from "lucide-react"
import Link from "next/link"
import type { EtudeWithRelations } from "@/types/database.types"

const STATUT_CONFIG = {
  prospection: {
    label: "Prospection",
    color: "bg-blue-100 text-blue-800 border-blue-200",
  },
  en_cours_prospection: {
    label: "En cours de prospection",
    color: "bg-cyan-100 text-cyan-800 border-cyan-200",
  },
  signee: {
    label: "Signée",
    color: "bg-purple-100 text-purple-800 border-purple-200",
  },
  en_cours: {
    label: "En cours",
    color: "bg-gold/20 text-gold border-gold/30",
  },
  terminee: {
    label: "Terminée",
    color: "bg-green-100 text-green-800 border-green-200",
  },
}

const STATUT_ORDER: Record<string, number> = {
  prospection: 0,
  en_cours_prospection: 1,
  signee: 2,
  en_cours: 3,
  terminee: 4,
}

export default function EtudesPage() {
  const [etudes, setEtudes] = useState<EtudeWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatut, setSelectedStatut] = useState<string | null>(null)

  useEffect(() => {
    const loadEtudes = async () => {
      setLoading(true)
      const result = await getEtudes()
      if (result.data) {
        setEtudes(result.data)
      }
      setLoading(false)
    }
    loadEtudes()
  }, [])

  const filteredEtudes = etudes
    .filter((etude) => {
      const matchesSearch =
        etude.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        etude.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        etude.clients?.nom.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesStatut = !selectedStatut || etude.statut === selectedStatut

      return matchesSearch && matchesStatut
    })
    .sort((a, b) => STATUT_ORDER[a.statut] - STATUT_ORDER[b.statut])

  const groupedByStatut = etudes.reduce(
    (acc, etude) => {
      const statut = etude.statut
      if (!acc[statut]) acc[statut] = 0
      acc[statut]++
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-navy">Études</h1>
          <p className="text-muted-foreground mt-1">
            Gestion des études et projets clients
          </p>
        </div>
        <Button className="w-full sm:w-auto bg-navy hover:bg-navy/90 gap-2">
          <Plus size={18} />
          Nouvelle étude
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {Object.entries(STATUT_CONFIG).map(([statut, config]) => (
          <Card
            key={statut}
            className="border-border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
            onClick={() =>
              setSelectedStatut(selectedStatut === statut ? null : statut)
            }
          >
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-navy">
                {groupedByStatut[statut] || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-2">{config.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <Card className="border-border shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Rechercher une étude par nom, numéro ou client..."
              className="pl-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Études List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      ) : filteredEtudes.length > 0 ? (
        <div className="space-y-4">
          {filteredEtudes.map((etude) => {
            const statutConfig =
              STATUT_CONFIG[etude.statut as keyof typeof STATUT_CONFIG]

            return (
              <Link key={etude.id} href={`/etudes/${etude.id}`}>
                <Card className="border-border shadow-sm hover:shadow-md hover:border-gold/30 transition-all cursor-pointer">
                  <CardContent className="p-6">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start gap-3">
                          <div>
                            <h3 className="font-heading font-semibold text-navy text-lg">
                              {etude.nom}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {etude.numero}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 mt-3">
                          {etude.clients && (
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full">
                              <span className="text-xs font-medium text-navy">
                                {etude.clients.nom}
                              </span>
                            </div>
                          )}

                          {etude.budget && (
                            <div className="inline-flex items-center gap-1 text-sm font-semibold text-gold">
                              €{etude.budget.toLocaleString()}
                            </div>
                          )}

                          <Badge
                            className={`border ${statutConfig.color}`}
                            variant="outline"
                          >
                            {statutConfig.label}
                          </Badge>
                        </div>

                        {etude.commentaire && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
                            {etude.commentaire}
                          </p>
                        )}
                      </div>

                      {etude.suiveur && (
                        <div className="flex-shrink-0 text-right">
                          <p className="text-xs text-muted-foreground">Suiveur</p>
                          <p className="text-sm font-medium text-navy">
                            {etude.suiveur.prenom} {etude.suiveur.nom}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {etude.suiveur.email}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      ) : (
        <Card className="border-border border-dashed py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="h-12 w-12 rounded-full bg-gold/10 flex items-center justify-center mb-4">
              <Calendar className="h-6 w-6 text-gold" />
            </div>
            <h3 className="font-heading font-semibold text-navy mb-2">
              Aucune étude trouvée
            </h3>
            <p className="text-muted-foreground max-w-sm">
              {searchTerm || selectedStatut
                ? "Essayez de modifier vos critères de recherche"
                : "Créez votre première étude pour commencer"}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Timeline/Gantt placeholder info */}
      <Card className="border-gold/30 bg-gold/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar size={18} className="text-gold" />
            Vue timeline
          </CardTitle>
          <CardDescription>
            Visualisez l'échéancier de vos études
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cliquez sur une étude pour voir son échéancier détaillé et ses
            jalons.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
