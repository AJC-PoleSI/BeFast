"use client"

import { useEffect, useState, useCallback, useReducer } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, FileText, Download, Trash2, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  listTemplates,
  deleteGeneratedDocument,
  listEtudeMissions,
  listMissionIntervenants,
  listEtudeAllDocuments,
} from "@/lib/actions/documents"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog"
import { DocumentViewer } from "@/components/documents/DocumentViewer"

type FormState = {
  selectedTemplateId: string
  selectedMissionId: string
  selectedIntervenantId: string
  showGenerateModal: boolean
  intervenants: any[]
}

type FormAction =
  | { type: "SET_TEMPLATE"; payload: string }
  | { type: "SET_MISSION"; payload: string }
  | { type: "SET_INTERVENANT"; payload: string }
  | { type: "SET_INTERVENANTS"; payload: any[] }
  | { type: "TOGGLE_MODAL"; payload: boolean }
  | { type: "RESET_FORM" }

const initialFormState: FormState = {
  selectedTemplateId: "",
  selectedMissionId: "",
  selectedIntervenantId: "",
  showGenerateModal: false,
  intervenants: [],
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_TEMPLATE":
      return { ...state, selectedTemplateId: action.payload }
    case "SET_MISSION":
      return { ...state, selectedMissionId: action.payload, selectedIntervenantId: "" }
    case "SET_INTERVENANT":
      return { ...state, selectedIntervenantId: action.payload }
    case "SET_INTERVENANTS":
      return { ...state, intervenants: action.payload }
    case "TOGGLE_MODAL":
      return { ...state, showGenerateModal: action.payload }
    case "RESET_FORM":
      return { ...initialFormState, intervenants: state.intervenants }
    default:
      return state
  }
}

export default function EtudeDocumentsPage() {
  const params = useParams()
  const etudeId = params.etudeId as string

  const [formState, dispatch] = useReducer(formReducer, initialFormState)
  const [templates, setTemplates] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [missions, setMissions] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string } | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [tRes, dRes, mRes] = await Promise.all([
      listTemplates(),
      listEtudeAllDocuments(etudeId),
      listEtudeMissions(etudeId),
    ])
    setTemplates((tRes as any).data || [])
    setDocs((dRes as any).data || [])
    setMissions((mRes as any).data || [])
    setLoading(false)
  }, [etudeId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // When mission changes, load its intervenants
  useEffect(() => {
    dispatch({ type: "SET_INTERVENANT", payload: "" })
    dispatch({ type: "SET_INTERVENANTS", payload: [] })
    if (!formState.selectedMissionId) return
    listMissionIntervenants(formState.selectedMissionId).then((res) => {
      const list = (res as any).data || []
      dispatch({ type: "SET_INTERVENANTS", payload: list })
      if (list.length === 1) dispatch({ type: "SET_INTERVENANT", payload: list[0].id })
    })
  }, [formState.selectedMissionId])

  const handleGenerate = async () => {
    if (!formState.selectedTemplateId) {
      toast.error("Sélectionnez un modèle")
      return
    }
    setGenerating(true)

    // If a mission is selected, use mission scope to get all mission/intervenant data
    const scope = formState.selectedMissionId ? "mission" : "etude"
    const entityId = formState.selectedMissionId || etudeId

    const res = await fetch("/api/documents/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: formState.selectedTemplateId,
        scope,
        entity_id: entityId,
        intervenant_id: formState.selectedIntervenantId || undefined,
      }),
    })
    const json = await res.json()
    if (!res.ok) toast.error(json?.error || "Erreur")
    else {
      toast.success("Document généré")
      window.open(`/api/documents/${json.data.id}/download`, "_blank")
      dispatch({ type: "RESET_FORM" })
      refresh()
    }
    setGenerating(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce document ?")) return
    const res = await deleteGeneratedDocument(id)
    if ((res as any).error) toast.error((res as any).error)
    else { toast.success("Supprimé"); refresh() }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link href={`/etudes/${etudeId}`}>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Retour à l&apos;étude
        </Button>
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-[#00236f] mb-1">Documents de l&apos;étude</h1>
        <p className="text-sm text-slate-500">Générez des documents à partir des modèles DOCX importés.</p>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" /> Générer un document
          </h2>
          <Button
            onClick={() => dispatch({ type: "TOGGLE_MODAL", payload: true })}
            size="sm"
            className="bg-[#00236f] text-white hover:bg-[#1e3a8a]"
            disabled={loading}
          >
            <FileText className="h-4 w-4 mr-1.5" />
            Nouveau document
          </Button>
        </div>
        {loading ? (
          <p className="text-xs text-muted-foreground">Chargement…</p>
        ) : templates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucun modèle disponible.{" "}
            <Link href="/administration/documents" className="text-[#00236f] underline">
              Gérer les modèles
            </Link>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {templates.length} modèle(s) disponible(s) — cliquez sur «&nbsp;Nouveau document&nbsp;» pour en générer un.
          </p>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3">Documents générés</h2>
        {loading ? (
          <p className="text-xs text-muted-foreground">Chargement…</p>
        ) : docs.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
            Aucun document généré pour cette étude.
          </div>
        ) : (
          <div className="space-y-2">
            {docs.map((d) => (
              <div
                key={d.id}
                className="bg-white rounded-xl border border-border shadow-sm p-3 flex items-center justify-between gap-3 cursor-pointer hover:border-[#00236f]/30 transition-colors"
                onClick={() => setPreviewDoc({ url: `/api/documents/${d.id}/preview`, name: d.file_name })}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-[#00236f] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{d.name}</div>
                    <div className="text-xs text-slate-500 truncate">
                      {d.file_name} · {new Date(d.created_at).toLocaleString("fr-FR")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a 
                    href={`/api/documents/${d.id}/download`} 
                    className="inline-flex items-center gap-1 text-xs text-[#00236f] hover:bg-[#00236f]/10 p-1.5 rounded transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  <button onClick={() => handleDelete(d.id)} className="text-red-500 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={formState.showGenerateModal} onOpenChange={(o) => !o && dispatch({ type: "TOGGLE_MODAL", payload: false })}>
        <DialogContent>
          <DialogClose onClose={() => dispatch({ type: "TOGGLE_MODAL", payload: false })} />
          <DialogHeader>
            <DialogTitle>Générer un document</DialogTitle>
            <DialogDescription>
              Sélectionnez le modèle et, si besoin, la mission et l&apos;intervenant concernés.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Modèle de document *</Label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input text-sm bg-white"
                value={formState.selectedTemplateId}
                onChange={(e) => dispatch({ type: "SET_TEMPLATE", payload: e.target.value })}
              >
                <option value="">-- Sélectionnez un modèle --</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.category ? ` (${t.category})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label>Mission (optionnel — requis pour les RDM)</Label>
              {missions.length > 0 ? (
                <select
                  className="w-full h-10 px-3 rounded-md border border-input text-sm bg-white"
                  value={formState.selectedMissionId}
                  onChange={(e) => dispatch({ type: "SET_MISSION", payload: e.target.value })}
                >
                  <option value="">-- Aucune (document d&apos;étude uniquement) --</option>
                  {missions.map((m) => (
                    <option key={m.id} value={m.id}>{m.nom}</option>
                  ))}
                </select>
              ) : (
                <p className="text-sm text-slate-500">Aucune mission sur cette étude.</p>
              )}
            </div>

            {formState.selectedMissionId && (
              <div className="space-y-2">
                <Label>Intervenant</Label>
                {formState.intervenants.length > 0 ? (
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input text-sm bg-white"
                    value={formState.selectedIntervenantId}
                    onChange={(e) => dispatch({ type: "SET_INTERVENANT", payload: e.target.value })}
                  >
                    <option value="">-- Aucun --</option>
                    {formState.intervenants.map((p) => (
                      <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-slate-500">Aucun intervenant assigné à cette mission.</p>
                )}
              </div>
            )}

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500">
              {formState.selectedMissionId
                ? "Le document sera généré avec les données de la mission, de l'étude, du client et de l'intervenant sélectionné."
                : "Le document sera généré avec les données de l'étude, du client et du suiveur."}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => dispatch({ type: "TOGGLE_MODAL", payload: false })}>Annuler</Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !formState.selectedTemplateId}
              className="bg-[#00236f] text-white hover:bg-[#1e3a8a]"
            >
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              Générer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentViewer
        open={!!previewDoc}
        onOpenChange={(open) => !open && setPreviewDoc(null)}
        url={previewDoc?.url || null}
        fileName={previewDoc?.name || null}
      />
    </div>
  )
}
