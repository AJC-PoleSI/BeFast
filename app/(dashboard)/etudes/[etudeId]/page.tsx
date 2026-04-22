"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { useUser } from "@/hooks/useUser"
import { createClient } from "@/lib/supabase/client"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  ArrowLeft,
  DollarSign,
  User,
  Briefcase,
  Calendar,
  Plus,
  Trash2,
  Loader2,
  BarChart3,
  ListChecks,
  FileText,
  Users,
  CheckCircle2,
  XCircle,
  Mail,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import type {
  EtudeWithRelations,
  Mission,
  EcheancierBloc,
} from "@/types/database.types"

const STATUT_COLORS: Record<string, string> = {
  prospection: "bg-purple-100 text-purple-700 border-purple-200",
  en_cours_prospection: "bg-amber-100 text-amber-700 border-amber-200",
  signee: "bg-emerald-100 text-emerald-700 border-emerald-200",
  en_cours: "bg-blue-100 text-blue-700 border-blue-200",
  terminee: "bg-gray-100 text-gray-600 border-gray-200",
}
const STATUT_LABELS: Record<string, string> = {
  prospection: "Prospection",
  en_cours_prospection: "En cours de prospection",
  signee: "Signée",
  en_cours: "En cours",
  terminee: "Terminée",
}
const MISSION_STATUT_COLORS: Record<string, string> = {
  ouverte: "bg-emerald-100 text-emerald-700",
  pourvue: "bg-blue-100 text-blue-700",
  terminee: "bg-gray-100 text-gray-600",
  annulee: "bg-red-100 text-red-600",
}
const MISSION_STATUT_LABELS: Record<string, string> = {
  ouverte: "Ouverte", pourvue: "Pourvue", terminee: "Terminée", annulee: "Annulée",
}

const GANTT_COLORS = [
  "#C9A84C", "#4A90D9", "#6366F1", "#EC4899", "#14B8A6", "#F97316", "#8B5CF6",
]

export default function EtudeDetailPage() {
  const params = useParams()
  const etudeId = params.etudeId as string
  const { isAdmin, permissions, loading: authLoading } = useUser()
  const canSelectCandidates = isAdmin || !!permissions?.selectionner_candidats

  const [etude, setEtude] = useState<EtudeWithRelations | null>(null)
  const [missions, setMissions] = useState<Mission[]>([])
  const [blocs, setBlocs] = useState<EcheancierBloc[]>([])
  const [candidatures, setCandidatures] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Mission creation modal
  const [showMissionModal, setShowMissionModal] = useState(false)
  const [missionForm, setMissionForm] = useState({
    nom: "", description: "", type: "intervenant", voie: "", classe: "",
    date_debut: "", date_fin: "", remuneration: "", nb_jeh: "0", nb_intervenants: "1", suiveur_id: "",
  })
  const [missionSuiveurs, setMissionSuiveurs] = useState<{ id: string; prenom: string; nom: string }[]>([])
  const [creatingMission, setCreatingMission] = useState(false)

  // Bloc creation / editing
  const [showBlocModal, setShowBlocModal] = useState(false)
  const [editingBlocId, setEditingBlocId] = useState<string | null>(null)
  const [blocForm, setBlocForm] = useState({
    nom: "", semaine_debut: "1", duree_semaines: "1", jeh: "0",
  })
  const [creatingBloc, setCreatingBloc] = useState(false)

  const [nbWeeks, setNbWeeks] = useState(12)

  const fetchData = useCallback(async () => {
    const supabase = createClient()

    const { data: e } = await supabase
      .from("etudes")
      .select("*, clients(id, nom, type), suiveur:personnes!etudes_suiveur_id_fkey(id, prenom, nom, email)")
      .eq("id", etudeId)
      .single()
    setEtude(e as unknown as EtudeWithRelations | null)

    const { data: m } = await supabase
      .from("missions")
      .select("*")
      .eq("etude_id", etudeId)
      .order("created_at", { ascending: true })
    setMissions((m as any[]) || [])

    const { data: b } = await supabase
      .from("echeancier_blocs")
      .select("*")
      .eq("etude_id", etudeId)
      .order("ordre", { ascending: true })
    setBlocs((b as EcheancierBloc[]) || [])

    // Candidatures de toutes les missions de l'étude
    const missionIds = ((m as any[]) || []).map(x => x.id)
    if (missionIds.length > 0) {
      const { data: cands } = await supabase
        .from("candidatures")
        .select("*, personnes!candidatures_personne_id_fkey(id, prenom, nom, email)")
        .in("mission_id", missionIds)
        .order("created_at", { ascending: true })
      setCandidatures((cands as any[]) || [])
    } else {
      setCandidatures([])
    }

    setLoading(false)
  }, [etudeId])

  useEffect(() => {
    if (!authLoading) fetchData()
  }, [authLoading, fetchData])

  // Tarif JEH par défaut pour l'affichage en €
  const [tarifJeh, setTarifJeh] = useState<number>(0)
  useEffect(() => {
    const sb = createClient()
    sb.from("parametres").select("value").eq("key", "tarif_jeh_default").maybeSingle()
      .then(({ data }) => setTarifJeh(Number(data?.value ?? 0) || 0))
  }, [])

  // Charger la liste des suiveurs potentiels
  useEffect(() => {
    const sb = createClient()
    ;(async () => {
      const { data: excl } = await sb.from("profils_types").select("id").in("slug", ["intervenant", "membre_en_attente"])
      const exclIds = (excl ?? []).map((r: any) => r.id)
      let q = sb.from("personnes").select("id, prenom, nom").eq("account_status", "validated").order("nom")
      if (exclIds.length > 0) q = q.not("profil_type_id", "in", `(${exclIds.join(",")})`)
      const { data } = await q
      setMissionSuiveurs((data as any[]) ?? [])
    })()
  }, [])

  const handleCreateMission = async () => {
    if (!missionForm.nom.trim()) { toast.error("Nom requis"); return }
    setCreatingMission(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const { data: newMission, error } = await supabase.from("missions").insert({
      etude_id: etudeId,
      nom: missionForm.nom,
      description: missionForm.description || null,
      type: missionForm.type,
      voie: missionForm.voie || null,
      classe: missionForm.classe || null,
      date_debut: missionForm.date_debut || null,
      date_fin: missionForm.date_fin || null,
      remuneration: missionForm.remuneration ? parseFloat(missionForm.remuneration) : null,
      nb_jeh: parseInt(missionForm.nb_jeh) || 0,
      nb_intervenants: parseInt(missionForm.nb_intervenants) || 1,
      created_by: user?.id,
    }).select().single()

    if (error) { toast.error(error.message || "Erreur") } else {
      // Auto-create bloc in échéancier
      if (newMission) {
        const maxSemaine = blocs.reduce(
          (max, b) => Math.max(max, (b.semaine_debut ?? 1) + (b.duree_semaines ?? 1) - 1),
          0
        )
        const jehTotal = (parseInt(missionForm.nb_jeh) || 0) * (parseInt(missionForm.nb_intervenants) || 1)
        await supabase.from("echeancier_blocs").insert({
          etude_id: etudeId,
          mission_id: newMission.id,
          nom: missionForm.nom,
          semaine_debut: maxSemaine + 1,
          duree_semaines: Math.max(1, Math.ceil(jehTotal / 5)),
          jeh: jehTotal || null,
          couleur: GANTT_COLORS[blocs.length % GANTT_COLORS.length],
          ordre: blocs.length,
        })
      }
      toast.success("Mission créée")
      setShowMissionModal(false)
      setMissionForm({ nom: "", description: "", type: "intervenant", voie: "", classe: "", date_debut: "", date_fin: "", remuneration: "", nb_jeh: "0", nb_intervenants: "1", suiveur_id: "" })
      fetchData()
    }
    setCreatingMission(false)
  }

  const handleSaveBloc = async () => {
    if (!blocForm.nom.trim()) { toast.error("Nom requis"); return }
    setCreatingBloc(true)
    const supabase = createClient()
    const payload = {
      nom: blocForm.nom,
      semaine_debut: parseInt(blocForm.semaine_debut) || 1,
      duree_semaines: parseInt(blocForm.duree_semaines) || 1,
      jeh: parseInt(blocForm.jeh) || 0,
    }
    let error
    if (editingBlocId) {
      ;({ error } = await supabase.from("echeancier_blocs").update(payload).eq("id", editingBlocId))
    } else {
      ;({ error } = await supabase.from("echeancier_blocs").insert({
        ...payload,
        etude_id: etudeId,
        couleur: GANTT_COLORS[blocs.length % GANTT_COLORS.length],
        ordre: blocs.length,
      }))
    }
    if (error) { toast.error("Erreur") } else {
      toast.success(editingBlocId ? "Bloc modifié" : "Bloc ajouté")
      setShowBlocModal(false)
      setEditingBlocId(null)
      setBlocForm({ nom: "", semaine_debut: "1", duree_semaines: "1", jeh: "0" })
      fetchData()
    }
    setCreatingBloc(false)
  }

  const handleCandidatureDecision = async (candId: string, statut: "acceptee" | "refusee") => {
    const supabase = createClient()
    const { error } = await supabase
      .from("candidatures")
      .update({ statut, reponse_date: new Date().toISOString() })
      .eq("id", candId)
    if (error) { toast.error(error.message || "Erreur"); return }
    toast.success(statut === "acceptee" ? "Candidature acceptée" : "Candidature refusée")
    fetchData()
  }

  const handleDeleteBloc = async (blocId: string) => {
    const supabase = createClient()
    const { error } = await supabase.from("echeancier_blocs").delete().eq("id", blocId)
    if (error) toast.error("Erreur")
    else { toast.success("Bloc supprimé"); fetchData() }
  }

  if (loading || authLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    )
  }

  if (!etude) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">Étude introuvable.</p>
      </div>
    )
  }

  const totalJehMissions = missions.reduce((sum, m) => sum + ((m.nb_jeh ?? 0) * (m.nb_intervenants ?? 1)), 0)
  const totalJeh = blocs.reduce((sum, b) => sum + (b.jeh || 0), 0) || totalJehMissions

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Link href="/etudes">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Retour aux études
          </Button>
        </Link>
        <Link href={`/etudes/${etudeId}/documents`}>
          <Button size="sm" variant="outline" className="border-[#00236f]/30 text-[#00236f] hover:bg-[#00236f]/5">
            <FileText className="h-4 w-4 mr-1.5" /> Documents
          </Button>
        </Link>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded">
                #{etude.numero}
              </span>
              <h1 className="font-heading text-2xl font-bold">{etude.nom}</h1>
              <Badge variant="outline" className={STATUT_COLORS[etude.statut]}>
                {STATUT_LABELS[etude.statut]}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {etude.clients && (
            <div className="rounded-lg bg-muted/30 p-3">
              <div className="text-xs text-muted-foreground mb-1">Client</div>
              <p className="font-medium text-sm">{etude.clients.nom}</p>
              <p className="text-xs text-muted-foreground uppercase">{etude.clients.type}</p>
            </div>
          )}
          {etude.suiveur && (
            <div className="rounded-lg bg-muted/30 p-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <User className="h-3 w-3" /> Suiveur
              </div>
              <p className="font-medium text-sm">{etude.suiveur.prenom} {etude.suiveur.nom}</p>
            </div>
          )}
          {etude.budget && (
            <div className="rounded-lg bg-muted/30 p-3">
              <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                <DollarSign className="h-3 w-3" /> Budget
              </div>
              <p className="font-medium text-sm">{Number(etude.budget).toLocaleString("fr-FR")}€</p>
            </div>
          )}
          {(() => {
            const base = Number((etude as any).budget_ht) || 0
            const frais = Number((etude as any).frais_dossier) || 0
            const margePct = Number((etude as any).marge_pct) || 0
            if (!base && !frais && !margePct) return null
            const margeEuros = base * (margePct / 100)
            const total = base + frais + margeEuros
            return (
              <div className="rounded-lg bg-gold/10 border border-gold/30 p-3">
                <div className="flex items-center gap-1 text-xs text-[#00236f] font-semibold mb-1">
                  <DollarSign className="h-3 w-3" /> Tarif étude HT
                </div>
                <p className="font-bold text-sm text-[#00236f]">
                  {total.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Base {base.toLocaleString("fr-FR")} € + frais {frais.toLocaleString("fr-FR")} € + marge {margePct}%
                </p>
              </div>
            )
          })()}
          <div className="rounded-lg bg-[#00236f]/5 border border-[#00236f]/10 p-3">
            <div className="text-xs text-[#00236f] font-semibold mb-1">Total JEH</div>
            <p className="font-bold text-lg text-[#00236f]">
              {totalJeh}
              {tarifJeh > 0 && (
                <span className="ml-2 text-sm font-semibold text-[#00236f]/70">
                  ({(totalJeh * tarifJeh).toLocaleString("fr-FR")} €)
                </span>
              )}
            </p>
            {totalJehMissions > 0 && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                {missions.length} mission{missions.length > 1 ? "s" : ""}
                {tarifJeh > 0 && ` · ${tarifJeh} €/JEH`}
              </p>
            )}
          </div>
        </div>

        {etude.commentaire && (
          <p className="mt-4 text-sm text-muted-foreground">{etude.commentaire}</p>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="missions">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="missions" className="gap-1.5">
            <ListChecks className="h-4 w-4" /> Missions ({missions.length})
          </TabsTrigger>
          <TabsTrigger value="echeancier" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Échéancier
          </TabsTrigger>
          {canSelectCandidates && (
            <TabsTrigger value="candidatures" className="gap-1.5">
              <Users className="h-4 w-4" /> Candidatures ({candidatures.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Missions tab */}
        <TabsContent value="missions">
          <div className="space-y-3">
            <div className="flex justify-end">
              <Button onClick={() => setShowMissionModal(true)} className="bg-gold text-navy font-semibold hover:bg-gold/90" size="sm">
                <Plus className="h-4 w-4 mr-1.5" /> Créer une mission
              </Button>
            </div>

            {missions.length === 0 ? (
              <div className="bg-white rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
                Aucune mission créée pour cette étude.
              </div>
            ) : (
              missions
                .filter((m: any) => isAdmin || canSelectCandidates || m.type !== "chef_projet")
                .map((m: any) => {
                const tarif = m.remuneration ?? m.taux_jour
                return (
                  <div key={m.id} className="group bg-white rounded-xl border border-border shadow-sm p-4 hover:shadow-md hover:border-gold/30 transition-all">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      {m.type === "chef_projet" ? (
                        <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0 cursor-default">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{m.nom}</span>
                          <Badge variant="outline" className={`text-xs ${MISSION_STATUT_COLORS[m.statut]}`}>
                            {MISSION_STATUT_LABELS[m.statut]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Suivi de projet
                          </span>
                          {etude?.numero && (
                            <span className="text-xs font-mono text-slate-400">#{etude.numero}</span>
                          )}
                        </div>
                      ) : (
                        <Link href={`/missions/${m.id}`} className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{m.nom}</span>
                          <Badge variant="outline" className={`text-xs ${MISSION_STATUT_COLORS[m.statut]}`}>
                            {MISSION_STATUT_LABELS[m.statut]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Intervenant
                          </span>
                          {etude?.numero && (
                            <span className="text-xs font-mono text-slate-400">#{etude.numero}</span>
                          )}
                        </Link>
                      )}
                      <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                        {tarif != null && (
                          <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" />{tarif}€/JEH</span>
                        )}
                        <span>
                          {m.nb_jeh} × {m.nb_intervenants} = <span className="font-semibold text-[#00236f]">{(m.nb_jeh ?? 0) * (m.nb_intervenants ?? 1)} JEH</span>
                          {tarif != null && (
                            <span className="ml-1 text-slate-500">
                              ({(((m.nb_jeh ?? 0) * (m.nb_intervenants ?? 1)) * (Number(tarif) || 0)).toLocaleString("fr-FR")} €)
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </TabsContent>

        {/* Échéancier tab */}
        <TabsContent value="echeancier">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Semaines :</span>
                <select
                  value={nbWeeks}
                  onChange={e => setNbWeeks(Number(e.target.value))}
                  className="h-8 px-2 text-sm border border-input rounded-md bg-white"
                >
                  {[4, 6, 8, 10, 12, 16, 20, 24, 30, 36, 52].map(n => (
                    <option key={n} value={n}>{n} semaines</option>
                  ))}
                </select>
              </div>
              <Button onClick={() => setShowBlocModal(true)} className="bg-gold text-navy font-semibold hover:bg-gold/90" size="sm">
                <Plus className="h-4 w-4 mr-1.5" /> Ajouter un bloc
              </Button>
            </div>

            {/* Gantt chart */}
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                  {/* Week headers */}
                  <div className="flex border-b border-border">
                    <div className="w-48 shrink-0 px-4 py-2 bg-muted/30 text-xs font-medium text-muted-foreground">
                      Phase
                    </div>
                    {Array.from({ length: nbWeeks }).map((_, i) => (
                      <div key={i} className="flex-1 px-1 py-2 text-center text-xs text-muted-foreground border-l border-border/50 bg-muted/10">
                        S{i + 1}
                      </div>
                    ))}
                  </div>

                  {/* Bloc rows */}
                  {blocs.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-sm">
                      Aucun bloc. Ajoutez des phases à l&apos;échéancier.
                    </div>
                  ) : (
                    blocs.map((bloc) => (
                      <div key={bloc.id} className="flex border-b border-border/50 group">
                        <div className="w-48 shrink-0 px-4 py-3 flex items-center justify-between text-sm">
                          <button
                            className="text-left"
                            onClick={() => {
                              setEditingBlocId(bloc.id)
                              setBlocForm({
                                nom: bloc.nom,
                                semaine_debut: String(bloc.semaine_debut),
                                duree_semaines: String(bloc.duree_semaines),
                                jeh: String(bloc.jeh ?? 0),
                              })
                              setShowBlocModal(true)
                            }}
                          >
                            <span className="font-medium hover:underline">{bloc.nom}</span>
                            <span className="text-xs text-muted-foreground ml-2">{bloc.jeh} JEH</span>
                          </button>
                          <button
                            onClick={() => handleDeleteBloc(bloc.id)}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <div className="flex-1 flex relative py-2" id={`track-${bloc.id}`}>
                          {Array.from({ length: nbWeeks }).map((_, i) => (
                            <div key={i} className="flex-1 border-l border-border/20" />
                          ))}
                          {/* Gantt bar (draggable) */}
                          <div
                            onMouseDown={(e) => {
                              const trackEl = document.getElementById(`track-${bloc.id}`)
                              if (!trackEl) return
                              const rect = trackEl.getBoundingClientRect()
                              const startX = e.clientX
                              const startSemaine = bloc.semaine_debut
                              const pxPerWeek = rect.width / nbWeeks
                              let finalSemaine = startSemaine

                              const onMove = (ev: MouseEvent) => {
                                const delta = Math.round((ev.clientX - startX) / pxPerWeek)
                                const newSemaine = Math.max(1, Math.min(nbWeeks - bloc.duree_semaines + 1, startSemaine + delta))
                                finalSemaine = newSemaine
                                setBlocs(prev => prev.map(b => b.id === bloc.id ? { ...b, semaine_debut: newSemaine } : b))
                              }
                              const onUp = async () => {
                                window.removeEventListener("mousemove", onMove)
                                window.removeEventListener("mouseup", onUp)
                                if (finalSemaine !== startSemaine) {
                                  const sb = createClient()
                                  await sb.from("echeancier_blocs")
                                    .update({ semaine_debut: finalSemaine })
                                    .eq("id", bloc.id)
                                }
                              }
                              window.addEventListener("mousemove", onMove)
                              window.addEventListener("mouseup", onUp)
                              e.preventDefault()
                            }}
                            className="absolute top-2 bottom-2 rounded-md shadow-sm flex items-center justify-center text-white text-xs font-medium cursor-grab active:cursor-grabbing select-none hover:ring-2 hover:ring-white/50 transition-all"
                            style={{
                              left: `${((bloc.semaine_debut - 1) / nbWeeks) * 100}%`,
                              width: `${(bloc.duree_semaines / nbWeeks) * 100}%`,
                              backgroundColor: bloc.couleur || "#C9A84C",
                              minWidth: "40px",
                            }}
                            title="Glisser pour déplacer"
                          >
                            {bloc.duree_semaines > 1 && `${bloc.duree_semaines}s`}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Candidatures tab */}
        {canSelectCandidates && (
          <TabsContent value="candidatures">
            <div className="space-y-4">
              {missions.length === 0 ? (
                <div className="bg-white rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
                  Aucune mission — donc aucune candidature.
                </div>
              ) : (
                missions.map((m: any) => {
                  const missionCands = candidatures.filter((c) => c.mission_id === m.id)
                  const acceptedCount = missionCands.filter((c) => c.statut === "acceptee").length
                  const maxInt = m.nb_intervenants ?? 1
                  const full = acceptedCount >= maxInt
                  return (
                    <div key={m.id} className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                      <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/30 border-b border-border flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Briefcase className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{m.nom}</span>
                          <Badge variant="outline" className={`text-xs ${MISSION_STATUT_COLORS[m.statut]}`}>
                            {MISSION_STATUT_LABELS[m.statut]}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {m.type === "chef_projet" ? "Suivi de projet" : "Intervenant"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-xs font-semibold ${
                              full
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : "bg-[#00236f]/5 text-[#00236f] border-[#00236f]/20"
                            }`}
                          >
                            {acceptedCount} / {maxInt} accepté{acceptedCount > 1 ? "s" : ""}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {missionCands.length} candidature{missionCands.length > 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>

                      {missionCands.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                          Aucune candidature pour cette mission.
                        </div>
                      ) : (
                        <div className="divide-y divide-border">
                          {missionCands.map((c: any) => {
                            const p = c.personnes
                            return (
                              <div key={c.id} className="px-4 py-3 flex items-start justify-between gap-4 flex-wrap">
                                <div className="flex-1 min-w-[240px]">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-sm">
                                      {p?.prenom} {p?.nom}
                                    </span>
                                    {p?.scolarite && (
                                      <Badge variant="outline" className="text-[10px] bg-muted/40">
                                        {p.scolarite}
                                      </Badge>
                                    )}
                                    {p?.promo && (
                                      <span className="text-[10px] text-muted-foreground">Promo {p.promo}</span>
                                    )}
                                    {c.statut === "acceptee" && (
                                      <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200">
                                        Acceptée
                                      </Badge>
                                    )}
                                    {c.statut === "refusee" && (
                                      <Badge className="text-[10px] bg-red-100 text-red-700 border-red-200">
                                        Refusée
                                      </Badge>
                                    )}
                                    {(!c.statut || c.statut === "en_attente") && (
                                      <Badge className="text-[10px] bg-amber-100 text-amber-700 border-amber-200">
                                        En attente
                                      </Badge>
                                    )}
                                  </div>
                                  {p?.email && (
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                                      <Mail className="h-3 w-3" />
                                      <a href={`mailto:${p.email}`} className="hover:underline">
                                        {p.email}
                                      </a>
                                    </div>
                                  )}
                                  {c.motivation && (
                                    <p className="text-xs text-slate-600 mt-2 whitespace-pre-wrap bg-muted/20 rounded-md p-2 border border-border/50">
                                      {c.motivation}
                                    </p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Button
                                    size="sm"
                                    onClick={() => handleCandidatureDecision(c.id, "acceptee")}
                                    disabled={
                                      c.statut === "acceptee" ||
                                      (full && c.statut !== "acceptee")
                                    }
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                    title={
                                      full && c.statut !== "acceptee"
                                        ? "Nombre max d'intervenants atteint"
                                        : "Accepter"
                                    }
                                  >
                                    <CheckCircle2 className="h-4 w-4 mr-1" /> Accepter
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCandidatureDecision(c.id, "refusee")}
                                    disabled={c.statut === "refusee"}
                                    className="text-red-600 border-red-200 hover:bg-red-50"
                                  >
                                    <XCircle className="h-4 w-4 mr-1" /> Refuser
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Mission creation modal */}
      <Dialog open={showMissionModal} onOpenChange={setShowMissionModal}>
        <DialogContent className="max-w-lg">
          <DialogClose onClose={() => setShowMissionModal(false)} />
          <DialogHeader>
            <DialogTitle>Créer une mission</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input value={missionForm.nom} onChange={(e) => setMissionForm({ ...missionForm, nom: e.target.value })} placeholder="Nom de la mission" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={missionForm.description} onChange={(e) => setMissionForm({ ...missionForm, description: e.target.value })} placeholder="Description détaillée..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Type</Label>
                <select value={missionForm.type} onChange={(e) => setMissionForm({ ...missionForm, type: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm">
                  <option value="intervenant">Intervenant</option>
                  <option value="chef_projet">Suivi de projet</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Voie</Label>
                <select value={missionForm.voie} onChange={(e) => setMissionForm({ ...missionForm, voie: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm">
                  <option value="">—</option>
                  <option value="finance">Finance</option>
                  <option value="marketing">Marketing</option>
                  <option value="audit">Audit</option>
                  <option value="rse">RSE</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Classe</Label>
                <select value={missionForm.classe} onChange={(e) => setMissionForm({ ...missionForm, classe: e.target.value })} className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm">
                  <option value="">—</option>
                  <option value="premaster">Premaster</option>
                  <option value="m1">M1</option>
                  <option value="m2">M2</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>JEH</Label>
                <Input type="number" value={missionForm.nb_jeh} onChange={(e) => setMissionForm({ ...missionForm, nb_jeh: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Intervenants</Label>
                <Input type="number" value={missionForm.nb_intervenants} onChange={(e) => setMissionForm({ ...missionForm, nb_intervenants: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date début</Label>
                <Input type="date" value={missionForm.date_debut} onChange={(e) => setMissionForm({ ...missionForm, date_debut: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Date fin</Label>
                <Input type="date" value={missionForm.date_fin} onChange={(e) => setMissionForm({ ...missionForm, date_fin: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rémunération (€)</Label>
              <Input type="number" value={missionForm.remuneration} onChange={(e) => setMissionForm({ ...missionForm, remuneration: e.target.value })} placeholder="0" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowMissionModal(false)}>Annuler</Button>
            <Button onClick={handleCreateMission} disabled={creatingMission || !missionForm.nom.trim()} className="bg-gold text-navy font-semibold hover:bg-gold/90">
              {creatingMission ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}
              Créer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bloc creation modal */}
      <Dialog open={showBlocModal} onOpenChange={(open) => { setShowBlocModal(open); if (!open) setEditingBlocId(null) }}>
        <DialogContent>
          <DialogClose onClose={() => { setShowBlocModal(false); setEditingBlocId(null) }} />
          <DialogHeader>
            <DialogTitle>{editingBlocId ? "Modifier le bloc" : "Ajouter un bloc à l'échéancier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>Nom du bloc *</Label>
              <Input value={blocForm.nom} onChange={(e) => setBlocForm({ ...blocForm, nom: e.target.value })} placeholder="Ex: Phase de cadrage" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Semaine début</Label>
                <Input type="number" min="1" max={nbWeeks} value={blocForm.semaine_debut} onChange={(e) => setBlocForm({ ...blocForm, semaine_debut: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Durée (semaines)</Label>
                <Input type="number" min="1" value={blocForm.duree_semaines} onChange={(e) => setBlocForm({ ...blocForm, duree_semaines: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>JEH</Label>
                <Input type="number" min="0" value={blocForm.jeh} onChange={(e) => setBlocForm({ ...blocForm, jeh: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowBlocModal(false); setEditingBlocId(null) }}>Annuler</Button>
            <Button onClick={handleSaveBloc} disabled={creatingBloc || !blocForm.nom.trim()} className="bg-gold text-navy font-semibold hover:bg-gold/90">
              {creatingBloc && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingBlocId ? "Enregistrer" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
