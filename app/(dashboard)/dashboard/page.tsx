"use client"

import { useEffect, useState } from "react"
import { useUser } from "@/hooks/useUser"
import { getMissions } from "@/lib/actions/missions"
import { getEtudes } from "@/lib/actions/etudes"
import { getMesCandidatures } from "@/lib/actions/missions"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import {
  Briefcase,
  GraduationCap,
  TrendingUp,
  FileText,
  ArrowRight,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react"
import Link from "next/link"
import type { MissionWithEtude, EtudeWithRelations, CandidatureWithMission } from "@/types/database.types"

interface DashboardStats {
  missionsOuvertes: number
  etundesEnCours: number
  candidatures: number
  taux: number
}

export default function DashboardPage() {
  const { profile } = useUser()
  const [stats, setStats] = useState<DashboardStats>({
    missionsOuvertes: 0,
    etundesEnCours: 0,
    candidatures: 0,
    taux: 0,
  })
  const [missions, setMissions] = useState<MissionWithEtude[]>([])
  const [etudes, setEtudes] = useState<EtudeWithRelations[]>([])
  const [candidatures, setCandidatures] = useState<CandidatureWithMission[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)

      // Load missions
      const missionsResult = await getMissions({ statut: "ouverte" })
      const missionsData = missionsResult.data || []
      setMissions(missionsData.slice(0, 3))

      // Load etudes
      const etudesResult = await getEtudes()
      const etudesData = etudesResult.data || []
      const etudesEnCours = etudesData.filter((e) => e.statut === "en_cours")
      setEtudes(etudesEnCours.slice(0, 3))

      // Load candidatures
      const candidaturesResult = await getMesCandidatures()
      const candidaturesData = candidaturesResult.data || []
      setCandidatures(candidaturesData.slice(0, 3))

      // Calculate stats
      setStats({
        missionsOuvertes: missionsData.length,
        etundesEnCours: etudesEnCours.length,
        candidatures: candidaturesData.length,
        taux: candidaturesData.length > 0 ? 75 : 0, // Mock percentage
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
      {/* Header */}
      <div>
        <h1 className="text-3xl font-heading font-bold text-navy">{greeting}</h1>
        <p className="text-muted-foreground mt-1">
          Voici un aperçu de vos activités récentes
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Missions Ouvertes */}
        <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Missions ouvertes
                </p>
                {loading ? (
                  <Skeleton className="h-8 w-12 mt-2" />
                ) : (
                  <p className="text-3xl font-bold text-navy mt-2">
                    {stats.missionsOuvertes}
                  </p>
                )}
              </div>
              <div className="h-12 w-12 rounded-lg bg-gold/10 flex items-center justify-center">
                <Briefcase size={24} className="text-gold" />
              </div>
            </div>
            <Link href="/missions">
              <Button
                variant="ghost"
                className="mt-4 w-full justify-between text-gold hover:text-gold/80 h-8"
              >
                Voir missions
                <ArrowRight size={16} />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Études en cours */}
        <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Études en cours
                </p>
                {loading ? (
                  <Skeleton className="h-8 w-12 mt-2" />
                ) : (
                  <p className="text-3xl font-bold text-navy mt-2">
                    {stats.etundesEnCours}
                  </p>
                )}
              </div>
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <GraduationCap size={24} className="text-blue-600" />
              </div>
            </div>
            <Link href="/etudes">
              <Button
                variant="ghost"
                className="mt-4 w-full justify-between text-blue-600 hover:text-blue-700 h-8"
              >
                Voir études
                <ArrowRight size={16} />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Mes candidatures */}
        <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Mes candidatures
                </p>
                {loading ? (
                  <Skeleton className="h-8 w-12 mt-2" />
                ) : (
                  <p className="text-3xl font-bold text-navy mt-2">
                    {stats.candidatures}
                  </p>
                )}
              </div>
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <TrendingUp size={24} className="text-purple-600" />
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-4">
              {stats.candidatures > 0 ? (
                <span className="text-green-600 font-medium">
                  {stats.taux}% d'acceptation
                </span>
              ) : (
                <span>Aucune candidature pour le moment</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Documents */}
        <Card className="border-border shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">
                  Documents
                </p>
                {loading ? (
                  <Skeleton className="h-8 w-12 mt-2" />
                ) : (
                  <p className="text-3xl font-bold text-navy mt-2">5</p>
                )}
              </div>
              <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                <FileText size={24} className="text-green-600" />
              </div>
            </div>
            <Link href="/profil">
              <Button
                variant="ghost"
                className="mt-4 w-full justify-between text-green-600 hover:text-green-700 h-8"
              >
                Gérer documents
                <ArrowRight size={16} />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="border-gold/30 bg-gold/5 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Actions rapides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Link href="/missions">
              <Button
                variant="outline"
                className="w-full justify-start border-gold/30 hover:bg-gold/10 text-left"
              >
                <Briefcase size={18} className="mr-2 text-gold flex-shrink-0" />
                <span className="text-sm font-medium text-navy">
                  Candidater
                </span>
              </Button>
            </Link>

            <Link href="/etudes">
              <Button
                variant="outline"
                className="w-full justify-start border-gold/30 hover:bg-gold/10 text-left"
              >
                <GraduationCap size={18} className="mr-2 text-gold flex-shrink-0" />
                <span className="text-sm font-medium text-navy">
                  Voir études
                </span>
              </Button>
            </Link>

            <Link href="/profil">
              <Button
                variant="outline"
                className="w-full justify-start border-gold/30 hover:bg-gold/10 text-left"
              >
                <FileText size={18} className="mr-2 text-gold flex-shrink-0" />
                <span className="text-sm font-medium text-navy">
                  Documents
                </span>
              </Button>
            </Link>

            <Button
              variant="outline"
              className="w-full justify-start border-gold/30 hover:bg-gold/10 text-left"
            >
              <AlertCircle size={18} className="mr-2 text-gold flex-shrink-0" />
              <span className="text-sm font-medium text-navy">Aide</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dernières missions */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-heading font-bold text-navy">
              Missions récentes
            </h2>
            <Link href="/missions">
              <Button variant="ghost" size="sm" className="text-gold gap-1">
                Voir tout
                <ArrowRight size={16} />
              </Button>
            </Link>
          </div>

          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-40 w-full rounded-lg" />
            </div>
          ) : missions.length > 0 ? (
            <div className="grid gap-4">
              {missions.map((mission) => (
                <Link key={mission.id} href={`/missions/${mission.id}`}>
                  <Card className="border-border shadow-sm hover:shadow-md hover:border-gold/30 transition-all cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h3 className="font-semibold text-navy">
                            {mission.nom}
                          </h3>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {mission.description}
                          </p>
                          <div className="flex items-center gap-4 mt-3 text-sm">
                            {mission.remuneration && (
                              <span className="text-gold font-semibold">
                                €{mission.remuneration.toLocaleString()}
                              </span>
                            )}
                            <span className="text-muted-foreground">
                              {mission.nb_jeh} JEH
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="border-border border-dashed py-8">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <Briefcase className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucune mission disponible
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Statut candidatures */}
        <div className="space-y-4">
          <h2 className="text-lg font-heading font-bold text-navy">
            Statut candidatures
          </h2>

          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          ) : candidatures.length > 0 ? (
            <div className="space-y-3">
              {candidatures.map((cand) => (
                <Card key={cand.id} className="border-border shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-navy">
                          {cand.missions?.nom}
                        </h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(cand.created_at).toLocaleDateString(
                            "fr-FR"
                          )}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        {cand.statut === "acceptee" && (
                          <CheckCircle size={20} className="text-green-600" />
                        )}
                        {cand.statut === "en_attente" && (
                          <Clock size={20} className="text-gold" />
                        )}
                        {cand.statut === "refusee" && (
                          <AlertCircle size={20} className="text-red-600" />
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="border-border border-dashed py-8">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <TrendingUp className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Aucune candidature
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
