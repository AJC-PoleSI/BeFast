"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { useUser } from "@/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  Briefcase,
  Calendar,
  DollarSign,
  Users,
  Globe,
  GraduationCap,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  User,
  Mail,
  FileText,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import type {
  MissionWithEtude,
  CandidatureWithPersonne,
  CandidatureWithMission,
} from "@/types/database.types"

const STATUT_COLORS: Record<string, string> = {
  ouverte: "bg-emerald-100 text-emerald-700 border-emerald-200",
  pourvue: "bg-blue-100 text-blue-700 border-blue-200",
  terminee: "bg-gray-100 text-gray-600 border-gray-200",
  annulee: "bg-red-100 text-red-600 border-red-200",
}

const STATUT_LABELS: Record<string, string> = {
  ouverte: "Ouverte",
  pourvue: "Pourvue",
  terminee: "Terminée",
  annulee: "Annulée",
}

const CAND_STATUT_COLORS: Record<string, string> = {
  en_attente: "bg-amber-100 text-amber-700",
  acceptee: "bg-emerald-100 text-emerald-700",
  refusee: "bg-red-100 text-red-600",
}

const CAND_STATUT_LABELS: Record<string, string> = {
  en_attente: "En attente",
  acceptee: "Acceptée",
  refusee: "Refusée",
}

export default function MissionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const missionId = params.missionId as string
  const { profile, isAdmin, permissions, loading: authLoading } = useUser()

  const [mission, setMission] = useState<MissionWithEtude | null>(null)
  const [candidatures, setCandidatures] = useState<CandidatureWithPersonne[]>([])
  const [myCandidature, setMyCandidature] = useState<CandidatureWithMission | null>(null)
  const [loading, setLoading] = useState(true)
  const [showCandidateModal, setShowCandidateModal] = useState(false)
  const [motivation, setMotivation] = useState("")
  const [classe, setClasse] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const slug = profile?.profils_types?.slug
  const isRH =
    (slug === "membre_ajc" || slug === "membre_agc") &&
    (profile?.pole ?? "").toLowerCase() === "rh"
  // isAGC = membres avec accès "staff" (voient toutes les candidatures, peuvent
  // accéder aux missions non publiées/SDP). Les membres AJC de base n'en font
  // PAS partie : ils doivent passer par le filtre (!isSDP && etudePublished).
  const isAGC =
    slug === "membre_agc" ||
    slug === "administrateur" ||
    isAdmin ||
    !!permissions?.selectionner_candidats
  const canSelectCandidates = isAdmin || isRH || !!permissions?.selectionner_candidats
  const isIntervenant = slug === "intervenant"
  const [filterClasse, setFilterClasse] = useState("")
  const [filterLangue, setFilterLangue] = useState("")

  const fetchData = useCallback(async () => {
    const supabase = createClient()

    const { data: m } = await supabase
      .from("missions")
      .select("*, etudes(id, nom, numero, published)")
      .eq("id", missionId)
      .single()

    setMission(m as MissionWithEtude | null)

    if (profile) {
      // Check if user already candidated
      const { data: mc } = await supabase
        .from("candidatures")
        .select("*, missions(id, nom, statut)")
        .eq("mission_id", missionId)
        .eq("personne_id", profile.id)
        .maybeSingle()
      setMyCandidature(mc as CandidatureWithMission | null)

      // If AGC, load all candidatures
      if (isAGC) {
        const { data: cands } = await supabase
          .from("candidatures")
          .select("*, personnes(id, prenom, nom, email, promo)")
          .eq("mission_id", missionId)
          .order("created_at", { ascending: true })
        setCandidatures((cands as CandidatureWithPersonne[]) || [])
      }
    }

    setLoading(false)
  }, [missionId, profile, isAGC])

  useEffect(() => {
    if (!authLoading && profile) fetchData()
    else if (!authLoading) setLoading(false)
  }, [authLoading, profile, fetchData])

  const handleCandidate = async () => {
    if (!motivation.trim()) {
      toast.error("Veuillez rédiger votre motivation")
      return
    }
    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.from("candidatures").insert({
      mission_id: missionId,
      personne_id: profile!.id,
      motivation,
      classe: classe || (profile as any)?.scolarite || (profile as any)?.classe || null,
      langues: [],
    })
    if (error) {
      toast.error(
        error.code === "23505"
          ? "Vous avez déjà candidaté"
          : "Erreur lors de la candidature"
      )
    } else {
      toast.success("Candidature envoyée !")
      setShowCandidateModal(false)
      setMotivation("")
      fetchData()
    }
    setSubmitting(false)
  }

  const handleReponse = async (candId: string, statut: "acceptee" | "refusee") => {
    const supabase = createClient()
    const { error } = await supabase
      .from("candidatures")
      .update({ statut, reponse_date: new Date().toISOString() })
      .eq("id", candId)
    if (error) {
      toast.error("Erreur")
    } else {
      toast.success(statut === "acceptee" ? "Candidature acceptée" : "Candidature refusée")
      fetchData()
    }
  }

  if (loading || authLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    )
  }

  if (!mission) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Mission introuvable.</p>
      </div>
    )
  }

  // Visibilité : les non-admins ne peuvent pas voir les missions SDP (chef_projet)
  // ni les missions dont l'étude parente n'est pas publiée.
  const isSDP = mission.type === "chef_projet"
  const etudePublished = (mission as any).etudes?.published === true
  const canView = isAdmin || isAGC || (!isSDP && etudePublished)

  if (!canView) {
    return (
      <div className="max-w-4xl mx-auto space-y-4">
        <Link href="/missions">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Retour aux missions
          </Button>
        </Link>
        <div className="bg-white rounded-xl border border-border shadow-sm p-10 text-center">
          <p className="font-heading text-lg font-semibold text-[#00236f] mb-2">
            Mission non accessible
          </p>
          <p className="text-sm text-muted-foreground">
            Cette mission n'est pas disponible à la candidature.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link href="/missions">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Retour aux missions
          </Button>
        </Link>
        {canSelectCandidates && (
          <Link href={`/missions/${mission.id}/documents`}>
            <Button size="sm" variant="outline" className="border-[#00236f]/30 text-[#00236f] hover:bg-[#00236f]/5">
              <FileText className="h-4 w-4 mr-1.5" /> Documents
            </Button>
          </Link>
        )}
      </div>

      {/* Mission info */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h1 className="font-heading text-2xl font-bold">
                  {mission.nom}
                </h1>
                <Badge
                  variant="outline"
                  className={STATUT_COLORS[mission.statut]}
                >
                  {STATUT_LABELS[mission.statut]}
                </Badge>
              </div>
              {mission.etudes && (
                <Link
                  href={`/etudes/${mission.etudes.id}`}
                  className="text-sm text-blue hover:underline flex items-center gap-1"
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  Étude {mission.etudes.numero} — {mission.etudes.nom}
                </Link>
              )}
            </div>

            {profile && mission.statut === "ouverte" && !myCandidature && !isSDP && etudePublished && (
              <Button
                onClick={() => setShowCandidateModal(true)}
                className="bg-gold text-navy font-semibold hover:bg-gold/90"
              >
                <Send className="h-4 w-4 mr-1.5" />
                Candidater
              </Button>
            )}
          </div>

          {mission.description && (
            <p className="text-sm text-muted-foreground mb-6 whitespace-pre-wrap">
              {mission.description}
            </p>
          )}

          {/* Details grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <InfoCard
              icon={<Briefcase className="h-4 w-4" />}
              label="Type"
              value={mission.type === "chef_projet" ? "Suivi de projet" : "Intervenant"}
            />
            {mission.voie && (
              <InfoCard
                icon={<GraduationCap className="h-4 w-4" />}
                label="Voie"
                value={mission.voie.charAt(0).toUpperCase() + mission.voie.slice(1)}
              />
            )}
            {mission.classe && (
              <InfoCard
                icon={<Users className="h-4 w-4" />}
                label="Classe"
                value={mission.classe.toUpperCase()}
              />
            )}
            {mission.remuneration && (
              <InfoCard
                icon={<DollarSign className="h-4 w-4" />}
                label="Rémunération"
                value={`${mission.remuneration}€`}
              />
            )}
            {mission.nb_jeh > 0 && (
              <InfoCard
                icon={<Calendar className="h-4 w-4" />}
                label="JEH"
                value={String(mission.nb_jeh)}
              />
            )}
            <InfoCard
              icon={<Users className="h-4 w-4" />}
              label="Intervenants"
              value={String(mission.nb_intervenants)}
            />
            {mission.date_debut && (
              <InfoCard
                icon={<Calendar className="h-4 w-4" />}
                label="Début"
                value={new Date(mission.date_debut).toLocaleDateString("fr-FR")}
              />
            )}
            {mission.date_fin && (
              <InfoCard
                icon={<Calendar className="h-4 w-4" />}
                label="Fin"
                value={new Date(mission.date_fin).toLocaleDateString("fr-FR")}
              />
            )}
          </div>

          {mission.langues && mission.langues.length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Langues :</span>
              {mission.langues.map((l) => (
                <Badge key={l} variant="outline" className="text-xs">
                  {l}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* My candidature status (intervenant) */}
      {myCandidature && (
        <div
          className={`rounded-xl border p-4 ${
            myCandidature.statut === "acceptee"
              ? "bg-emerald-50 border-emerald-200"
              : myCandidature.statut === "refusee"
                ? "bg-red-50 border-red-200"
                : "bg-amber-50 border-amber-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {myCandidature.statut === "en_attente" && (
              <Clock className="h-5 w-5 text-amber-600" />
            )}
            {myCandidature.statut === "acceptee" && (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            )}
            {myCandidature.statut === "refusee" && (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <span className="font-medium text-sm">
              Votre candidature :{" "}
              {CAND_STATUT_LABELS[myCandidature.statut]}
            </span>
          </div>
        </div>
      )}

      {/* Candidatures (AGC view) */}
      {isAGC && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-navy/[0.02] to-transparent flex items-center justify-between gap-3 flex-wrap">
            <h3 className="font-heading text-lg font-semibold">
              Candidatures ({candidatures.length})
            </h3>
            {canSelectCandidates && (
              <div className="flex items-center gap-2">
                <select
                  value={filterClasse}
                  onChange={(e) => setFilterClasse(e.target.value)}
                  className="h-8 px-2 rounded-md border border-input bg-white text-xs"
                >
                  <option value="">Tous niveaux</option>
                  <option value="premaster">Premaster</option>
                  <option value="m1">M1</option>
                  <option value="m2">M2</option>
                </select>
                <select
                  value={filterLangue}
                  onChange={(e) => setFilterLangue(e.target.value)}
                  className="h-8 px-2 rounded-md border border-input bg-white text-xs"
                >
                  <option value="">Toutes langues</option>
                  <option value="FR">Français</option>
                  <option value="EN">Anglais</option>
                  <option value="ES">Espagnol</option>
                  <option value="DE">Allemand</option>
                </select>
              </div>
            )}
          </div>

          {candidatures.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              Aucune candidature reçue.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {candidatures
                .filter((c) => !filterClasse || c.classe === filterClasse)
                .filter((c) => {
                  if (!filterLangue) return true
                  const langues = (c as any).langues
                  if (Array.isArray(langues)) {
                    return langues.some((l: any) =>
                      typeof l === "string"
                        ? l.toUpperCase().includes(filterLangue)
                        : (l?.langue ?? "").toUpperCase().includes(filterLangue)
                    )
                  }
                  return false
                })
                .map((cand) => (
                <div key={cand.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium text-sm">
                        {cand.personnes?.prenom} {cand.personnes?.nom}
                      </span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${CAND_STATUT_COLORS[cand.statut]}`}
                      >
                        {CAND_STATUT_LABELS[cand.statut]}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {cand.personnes?.email}
                      </span>
                      {cand.personnes?.promo && (
                        <span>Promo {cand.personnes.promo}</span>
                      )}
                      {cand.classe && (
                        <span>Classe : {cand.classe.toUpperCase()}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {cand.motivation}
                    </p>
                  </div>

                  {cand.statut === "en_attente" && canSelectCandidates && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleReponse(cand.id, "acceptee")}
                        className="bg-emerald-600 text-white hover:bg-emerald-700 h-8 text-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Accepter
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleReponse(cand.id, "refusee")}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 text-xs"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Refuser
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Candidature modal */}
      <Dialog open={showCandidateModal} onOpenChange={setShowCandidateModal}>
        <DialogContent>
          <DialogClose onClose={() => setShowCandidateModal(false)} />
          <DialogHeader>
            <DialogTitle>Candidater à cette mission</DialogTitle>
            <DialogDescription>
              Expliquez pourquoi vous êtes le meilleur candidat.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prénom</Label>
                <Input value={profile?.prenom ?? ""} readOnly disabled />
              </div>
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={profile?.nom ?? ""} readOnly disabled />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Niveau d'étude</Label>
              <Input
                value={(profile as any)?.scolarite ?? (profile as any)?.classe ?? ""}
                readOnly
                disabled
                placeholder="Non renseigné"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivation">
                Motivations <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="motivation"
                value={motivation}
                onChange={(e) => setMotivation(e.target.value)}
                placeholder="Pourquoi souhaitez-vous participer à cette mission ?"
                className="min-h-[140px]"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setShowCandidateModal(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              onClick={handleCandidate}
              disabled={submitting || !motivation.trim()}
              className="bg-gold text-navy font-semibold hover:bg-gold/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="mr-1.5 h-4 w-4" />
                  Envoyer ma candidature
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <p className="font-medium text-sm">{value}</p>
    </div>
  )
}
