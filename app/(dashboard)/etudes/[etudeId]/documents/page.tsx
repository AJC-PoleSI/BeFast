"use client"

import { useEffect, useState, useCallback, useReducer } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, FileText, Download, Trash2, Sparkles, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  listTemplates,
  deleteGeneratedDocument,
  listEtudeMissions,
  listMissionIntervenants,
  listEtudeAllDocuments,
} from "@/lib/actions/documents"
import { getEtude } from "@/lib/actions/etudes"
import { useUser } from "@/hooks/useUser"
import { canEditEtude } from "@/lib/auth/permissions"
import { IntervenantConcerne } from "@/components/documents/IntervenantConcerne"
import { DocumentViewer } from "@/components/documents/DocumentViewer"
import { documentDownloadName } from "@/lib/documents/download-name"
import { NomenclatureAide } from "@/components/documents/NomenclatureAide"
import { ChampsAvenant } from "@/components/documents/ChampsAvenant"
import {
  CATEGORIES_AVENANT,
  validerChampsAvenant,
  valeursParDefaut,
  type ValeursAvenant,
} from "@/lib/documents/avenants"
import { CATEGORIES_PAR_INTERVENANT, CATEGORY_CODES } from "@/lib/documents/nomenclature"
import { declencherTelechargement, telechargerZip } from "@/lib/documents/zip-client"
import { numeroEtudeCourt, segmentRdmParent } from "@/lib/document-numbering"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog"

type FormState = {
  selectedTemplateId: string
  selectedMissionId: string
  // Un seul id pour un modèle « classique », plusieurs pour un modèle propre à
  // chaque intervenant (RDM, avenants, BV…) : un document par personne cochée.
  selectedIntervenantIds: string[]
  showGenerateModal: boolean
  intervenants: any[]
  // Référence du document dont la sélection a été reprise (null = formulaire vierge)
  reprisDe: string | null
}

type FormAction =
  | { type: "SET_TEMPLATE"; payload: string }
  | { type: "SET_MISSION"; payload: string }
  | { type: "SET_INTERVENANTS"; payload: string[] }
  | { type: "TOGGLE_INTERVENANT"; payload: string }
  | { type: "INTERVENANTS_LOADED"; payload: any[] }
  | { type: "TOGGLE_MODAL"; payload: boolean }
  | {
      type: "OPEN_MODAL"
      payload: { templateId: string; missionId: string; intervenantId: string; reprisDe: string | null }
    }
  | { type: "CLEAR_SELECTION" }

const initialFormState: FormState = {
  selectedTemplateId: "",
  selectedMissionId: "",
  selectedIntervenantIds: [],
  showGenerateModal: false,
  intervenants: [],
  reprisDe: null,
}

// Garde les intervenants voulus s'ils sont bien sur la mission ; sinon, s'il n'y
// en a qu'un, on le sélectionne d'office.
function choisirIntervenants(list: any[], souhaites: string[]): string[] {
  const gardes = souhaites.filter((id) => list.some((p) => p.id === id))
  if (gardes.length > 0) return gardes
  return list.length === 1 ? [list[0].id] : []
}

function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case "SET_TEMPLATE":
      return { ...state, selectedTemplateId: action.payload }
    case "SET_MISSION":
      return { ...state, selectedMissionId: action.payload, selectedIntervenantIds: [], intervenants: [] }
    case "SET_INTERVENANTS":
      return { ...state, selectedIntervenantIds: action.payload }
    case "TOGGLE_INTERVENANT":
      return {
        ...state,
        selectedIntervenantIds: state.selectedIntervenantIds.includes(action.payload)
          ? state.selectedIntervenantIds.filter((id) => id !== action.payload)
          : [...state.selectedIntervenantIds, action.payload],
      }
    case "INTERVENANTS_LOADED":
      return {
        ...state,
        intervenants: action.payload,
        selectedIntervenantIds: choisirIntervenants(action.payload, state.selectedIntervenantIds),
      }
    case "TOGGLE_MODAL":
      return { ...state, showGenerateModal: action.payload }
    case "OPEN_MODAL": {
      const { templateId, missionId, intervenantId, reprisDe } = action.payload
      // Même mission : sa liste d'intervenants est déjà chargée (l'effet ne
      // repassera pas). Autre mission : l'effet recharge la liste puis valide
      // l'intervenant via INTERVENANTS_LOADED.
      const memeMission = missionId === state.selectedMissionId
      return {
        ...state,
        showGenerateModal: true,
        selectedTemplateId: templateId,
        selectedMissionId: missionId,
        intervenants: memeMission ? state.intervenants : [],
        selectedIntervenantIds: memeMission
          ? choisirIntervenants(state.intervenants, intervenantId ? [intervenantId] : [])
          : intervenantId
            ? [intervenantId]
            : [],
        reprisDe,
      }
    }
    case "CLEAR_SELECTION":
      return { ...initialFormState, showGenerateModal: state.showGenerateModal }
    default:
      return state
  }
}

export default function EtudeDocumentsPage() {
  const params = useParams()
  const etudeId = params.etudeId as string
  const { profile } = useUser()

  const [formState, dispatch] = useReducer(formReducer, initialFormState)
  const [templates, setTemplates] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  // Clic sur un document → aperçu ; bouton « Télécharger » → fichier (demande de Baptiste, 02/10/2026).
  const [previewDoc, setPreviewDoc] = useState<{ url: string; downloadUrl: string; name: string } | null>(null)
  const [missions, setMissions] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  // Génération groupée : avancement (documents faits / total) puis bilan.
  const [avancement, setAvancement] = useState<{ fait: number; total: number } | null>(null)
  const [bilan, setBilan] = useState<{
    docs: any[]
    erreurs: { nom: string; error: string }[]
    nomArchive: string
  } | null>(null)
  const [zipEnCours, setZipEnCours] = useState(false)
  // Passages propres à un avenant (objet, nouvelle date, motifs…), saisis ici plutôt que dans Word.
  const [champsAvenant, setChampsAvenant] = useState<ValeursAvenant>({})
  const [filtreIntervenant, setFiltreIntervenant] = useState("")
  const [etudeNumero, setEtudeNumero] = useState("")
  const [loading, setLoading] = useState(true)
  const [etudeAcces, setEtudeAcces] = useState<{
    created_by: string | null
    suiveurs: { id: string }[]
  }>({ created_by: null, suiveurs: [] })
  // Générer un document = créateur de l'étude, ses suiveurs (chefs de projet),
  // Pôle SI, admin — même règle que la modification de l'étude (canEditEtude).
  const canGenerate = canEditEtude(profile, etudeAcces)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [tRes, dRes, mRes, eRes] = await Promise.all([
      listTemplates(),
      listEtudeAllDocuments(etudeId),
      listEtudeMissions(etudeId),
      getEtude(etudeId),
    ])
    setTemplates((tRes as any).data || [])
    setDocs((dRes as any).data || [])
    setMissions((mRes as any).data || [])
    setEtudeAcces({
      created_by: (eRes as any).data?.created_by ?? null,
      suiveurs: (eRes as any).data?.suiveurs ?? [],
    })
    setEtudeNumero((eRes as any).data?.numero ?? "")
    setLoading(false)
  }, [etudeId])

  // Après une génération, seule la liste des documents change : inutile de
  // recharger modèles, missions et étude (ni de masquer la liste).
  const refreshDocs = useCallback(async () => {
    const dRes = await listEtudeAllDocuments(etudeId)
    setDocs((dRes as any).data || [])
  }, [etudeId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // When mission changes, load its intervenants
  useEffect(() => {
    if (!formState.selectedMissionId) return
    let annule = false
    listMissionIntervenants(formState.selectedMissionId).then((res) => {
      if (!annule) dispatch({ type: "INTERVENANTS_LOADED", payload: (res as any).data || [] })
    })
    return () => {
      annule = true
    }
  }, [formState.selectedMissionId])

  const modeleChoisi = templates.find((t) => t.id === formState.selectedTemplateId)
  const parIntervenant = CATEGORIES_PAR_INTERVENANT.has(modeleChoisi?.category)
  const codeModele = modeleChoisi ? CATEGORY_CODES[modeleChoisi.category] : undefined
  const idsChoisis = formState.selectedIntervenantIds
  const groupe = parIntervenant && idsChoisis.length > 1
  const categorieAvenant = CATEGORIES_AVENANT.has(modeleChoisi?.category) ? (modeleChoisi.category as string) : null

  // Forme du nom qui sera donné au document (« 26 AV## RDM## 18 »), rappelée sous le modèle.
  const nomPrevu = modeleChoisi
    ? [
        String(new Date().getFullYear()).slice(-2),
        codeModele ? (codeModele.numbered ? `${codeModele.code}##` : codeModele.code) : "",
        codeModele?.parentRdm ? "RDM##" : "",
        numeroEtudeCourt(etudeNumero) || "NN",
      ]
        .filter(Boolean)
        .join(" ")
    : ""

  // Dernier RDM de chaque intervenant (docs est trié du plus récent au plus ancien) :
  // un avenant s'applique à CE RDM.
  const rdmParIntervenant = new Map<string, string>()
  for (const d of docs) {
    const cat = templates.find((t) => t.id === d.template_id)?.category
    if (cat === "rdm" && d.intervenant_id && !rdmParIntervenant.has(d.intervenant_id)) {
      rdmParIntervenant.set(d.intervenant_id, segmentRdmParent(d.file_name))
    }
  }
  const exigeRdm = !!codeModele?.parentRdm
  const intervenantsAffiches = formState.intervenants.filter((p) =>
    `${p.prenom} ${p.nom}`.toLowerCase().includes(filtreIntervenant.trim().toLowerCase())
  )

  // « Nouveau document » reprend la dernière génération de l'étude (modèle,
  // mission, intervenant) : enchaîner RDM, avenant, BV… sans tout resélectionner.
  const openGenerateModal = () => {
    const dernier = docs[0]
    const templateId =
      dernier && templates.some((t) => t.id === dernier.template_id) ? dernier.template_id : ""
    const missionId =
      dernier?.scope === "mission" && missions.some((m) => m.id === dernier.entity_id) ? dernier.entity_id : ""
    setBilan(null)
    setAvancement(null)
    setFiltreIntervenant("")
    // La saisie d'un avenant survit à une fermeture accidentelle de la fenêtre ;
    // seule une première ouverture reçoit les valeurs par défaut du modèle repris.
    const catRepris = templates.find((t) => t.id === templateId)?.category
    if (CATEGORIES_AVENANT.has(catRepris) && Object.keys(champsAvenant).length === 0) {
      setChampsAvenant(valeursParDefaut(catRepris))
    }
    dispatch({
      type: "OPEN_MODAL",
      payload: {
        templateId,
        missionId,
        intervenantId: missionId ? dernier.intervenant_id || "" : "",
        reprisDe: templateId || missionId ? String(dernier.file_name).replace(/\.(docx|pptx|pdf)$/i, "") : null,
      },
    })
  }

  const handleGenerate = async () => {
    if (!formState.selectedTemplateId) {
      toast.error("Sélectionnez un modèle")
      return
    }
    if (categorieAvenant && categorieAvenant !== "avenant_mission") {
      if (!formState.selectedMissionId) {
        toast.error("Sélectionnez la mission concernée par l'avenant")
        return
      }
      if (idsChoisis.length === 0) {
        toast.error("Cochez au moins un intervenant")
        return
      }
    }
    if (categorieAvenant) {
      const erreurs = validerChampsAvenant(categorieAvenant, champsAvenant)
      if (erreurs.length > 0) {
        toast.error(erreurs[0])
        return
      }
    }
    if (groupe) return handleGenerateGroupe()
    setGenerating(true)

    // If a mission is selected, use mission scope to get all mission/intervenant data
    const scope = formState.selectedMissionId ? "mission" : "etude"
    const entityId = formState.selectedMissionId || etudeId

    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: formState.selectedTemplateId,
          scope,
          entity_id: entityId,
          intervenant_id: idsChoisis[0] || undefined,
          champs: categorieAvenant ? champsAvenant : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) toast.error(json?.error || "Erreur")
      else {
        toast.success("Document généré")
        // Téléchargement immédiat sans ouvrir d'onglet (un popup serait bloqué après l'attente).
        declencherTelechargement(`/api/documents/${json.data.id}/download`)
        dispatch({ type: "TOGGLE_MODAL", payload: false })
        refreshDocs()
      }
    } catch {
      toast.error("Erreur réseau")
    }
    setGenerating(false)
  }

  // Un document par intervenant coché, par lots de 6 : le serveur charge les
  // données de la mission une fois par lot et rend les documents en parallèle.
  const handleGenerateGroupe = async () => {
    const LOT = 6
    const ordre = formState.intervenants.filter((p) => idsChoisis.includes(p.id))
    const nomDe = (id: string) => {
      const p = ordre.find((x) => x.id === id)
      return p ? `${p.prenom} ${p.nom}` : id
    }
    setGenerating(true)
    setBilan(null)
    setAvancement({ fait: 0, total: ordre.length })
    const docsGeneres: any[] = []
    const erreurs: { nom: string; error: string }[] = []
    try {
      for (let i = 0; i < ordre.length; i += LOT) {
        const lot = ordre.slice(i, i + LOT)
        const res = await fetch("/api/documents/generate-batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            template_id: formState.selectedTemplateId,
            mission_id: formState.selectedMissionId,
            intervenant_ids: lot.map((p) => p.id),
            champs: categorieAvenant ? champsAvenant : undefined,
          }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          for (const p of lot) erreurs.push({ nom: nomDe(p.id), error: json?.error || "Erreur" })
        } else {
          for (const r of json.resultats as any[]) {
            if (r.ok) docsGeneres.push({ ...r.data, intervenant: ordre.find((p) => p.id === r.intervenant_id) ?? null })
            else erreurs.push({ nom: nomDe(r.intervenant_id), error: r.error })
          }
        }
        setAvancement({ fait: Math.min(i + LOT, ordre.length), total: ordre.length })
      }
    } catch {
      toast.error("Erreur réseau")
    }
    setBilan({
      docs: docsGeneres,
      erreurs,
      nomArchive: `${modeleChoisi?.name ?? "Documents"} - ${numeroEtudeCourt(etudeNumero) || "étude"}`.replace(/[\\/:*?"<>|]/g, ""),
    })
    setAvancement(null)
    setGenerating(false)
    refreshDocs()
    if (docsGeneres.length > 0) toast.success(`${docsGeneres.length} document(s) généré(s)`)
    if (erreurs.length > 0) toast.error(`${erreurs.length} document(s) non généré(s)`)
  }

  const handleZip = async () => {
    if (!bilan || bilan.docs.length === 0) return
    setZipEnCours(true)
    try {
      await telechargerZip(bilan.docs, bilan.nomArchive)
    } catch (e: any) {
      toast.error(e?.message || "Archive impossible")
    }
    setZipEnCours(false)
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
        <p className="text-sm text-zinc-500">Générez des documents à partir des modèles DOCX importés.</p>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" /> Générer un document
          </h2>
          {canGenerate && (
            <Button
              onClick={openGenerateModal}
              size="sm"
              className="bg-[#00236f] text-white hover:bg-[#1e3a8a]"
              disabled={loading}
            >
              <FileText className="h-4 w-4 mr-1.5" />
              Nouveau document
            </Button>
          )}
        </div>
        {loading ? (
          <p className="text-xs text-muted-foreground">Chargement…</p>
        ) : !canGenerate ? (
          <p className="text-xs text-muted-foreground">
            Seuls le créateur de l&apos;étude, le Pôle SI et les administrateurs peuvent générer un document.
          </p>
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
                onClick={() =>
                  setPreviewDoc({
                    url: `/api/documents/${d.id}/preview`,
                    downloadUrl: `/api/documents/${d.id}/download`,
                    name: documentDownloadName(d.file_name, d.intervenant),
                  })
                }
              >
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-[#00236f] shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium truncate">{d.name}</span>
                      <IntervenantConcerne personne={d.intervenant} />
                    </div>
                    <div className="text-xs text-zinc-500 truncate">
                      {d.file_name} · {new Date(d.created_at).toLocaleString("fr-FR")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/documents/${d.id}/download`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#00236f] hover:bg-[#00236f]/10 px-2 py-1.5 rounded transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Télécharger
                  </a>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(d.id)
                    }}
                    className="text-red-500 hover:text-red-700"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={formState.showGenerateModal} onOpenChange={(o) => !o && dispatch({ type: "TOGGLE_MODAL", payload: false })}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogClose onClose={() => dispatch({ type: "TOGGLE_MODAL", payload: false })} />
          <DialogHeader>
            <DialogTitle>Générer un document</DialogTitle>
            <DialogDescription>
              Sélectionnez le modèle et, si besoin, la mission et l&apos;intervenant concernés.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {formState.reprisDe && (
              <div className="flex items-center justify-between gap-3 rounded-lg bg-[#00236f]/5 border border-[#00236f]/10 px-3 py-2 text-xs text-[#00236f]">
                <span>Sélection reprise de la dernière génération ({formState.reprisDe}).</span>
                <button
                  type="button"
                  className="shrink-0 underline hover:no-underline"
                  onClick={() => dispatch({ type: "CLEAR_SELECTION" })}
                >
                  Tout effacer
                </button>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label>Modèle de document *</Label>
                <NomenclatureAide />
              </div>
              <select
                className="w-full h-10 px-3 rounded-md border border-input text-sm bg-white"
                value={formState.selectedTemplateId}
                onChange={(e) => {
                  dispatch({ type: "SET_TEMPLATE", payload: e.target.value })
                  const cat = templates.find((t) => t.id === e.target.value)?.category
                  setChampsAvenant(CATEGORIES_AVENANT.has(cat) ? valeursParDefaut(cat) : {})
                  setBilan(null)
                }}
              >
                <option value="">-- Sélectionnez un modèle --</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.category ? ` (${t.category})` : ""}
                  </option>
                ))}
              </select>
              {nomPrevu && (
                <p className="text-xs text-zinc-500">
                  Nom du document : <code className="font-mono text-[#00236f]">{nomPrevu}</code>
                </p>
              )}
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
                <p className="text-sm text-zinc-500">Aucune mission sur cette étude.</p>
              )}
            </div>

            {formState.selectedMissionId && (
              <div className="space-y-2">
                {parIntervenant ? (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <Label>
                        Intervenants{" "}
                        <span className="font-normal text-zinc-500">
                          ({idsChoisis.length}/{formState.intervenants.length} — un document par personne)
                        </span>
                      </Label>
                      {formState.intervenants.length > 1 && (
                        <div className="flex gap-3 text-xs">
                          <button
                            type="button"
                            className="text-[#00236f] underline hover:no-underline"
                            onClick={() =>
                              dispatch({ type: "SET_INTERVENANTS", payload: formState.intervenants.map((p) => p.id) })
                            }
                          >
                            Tout sélectionner
                          </button>
                          <button
                            type="button"
                            className="text-zinc-500 underline hover:no-underline"
                            onClick={() => dispatch({ type: "SET_INTERVENANTS", payload: [] })}
                          >
                            Aucun
                          </button>
                        </div>
                      )}
                    </div>
                    {formState.intervenants.length > 8 && (
                      <input
                        type="search"
                        value={filtreIntervenant}
                        onChange={(e) => setFiltreIntervenant(e.target.value)}
                        placeholder="Rechercher un intervenant…"
                        className="w-full h-9 px-3 rounded-md border border-input text-sm bg-white"
                      />
                    )}
                    {formState.intervenants.length > 0 ? (
                      <div className="max-h-56 overflow-y-auto rounded-md border border-input divide-y">
                        {intervenantsAffiches.map((p) => {
                          const rdm = rdmParIntervenant.get(p.id)
                          return (
                            <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                              <Checkbox
                                isSelected={idsChoisis.includes(p.id)}
                                onChange={() => dispatch({ type: "TOGGLE_INTERVENANT", payload: p.id })}
                              >
                                {p.prenom} {p.nom}
                              </Checkbox>
                              {exigeRdm &&
                                (rdm ? (
                                  <span className="text-xs font-mono text-zinc-500">{rdm}</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs text-amber-700">
                                    <AlertTriangle className="h-3 w-3" /> pas de RDM
                                  </span>
                                ))}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">Aucun intervenant assigné à cette mission.</p>
                    )}
                  </>
                ) : (
                  <>
                    <Label>Intervenant</Label>
                    {formState.intervenants.length > 0 ? (
                      <select
                        className="w-full h-10 px-3 rounded-md border border-input text-sm bg-white"
                        value={idsChoisis[0] ?? ""}
                        onChange={(e) =>
                          dispatch({ type: "SET_INTERVENANTS", payload: e.target.value ? [e.target.value] : [] })
                        }
                      >
                        <option value="">-- Aucun --</option>
                        {formState.intervenants.map((p) => (
                          <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-sm text-zinc-500">Aucun intervenant assigné à cette mission.</p>
                    )}
                  </>
                )}
              </div>
            )}

            {categorieAvenant && (
              <ChampsAvenant category={categorieAvenant} valeurs={champsAvenant} onChange={setChampsAvenant} />
            )}

            {(avancement || bilan) && (
              <div className="rounded-lg border border-zinc-200 p-3 text-sm space-y-2">
                {avancement && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-zinc-700">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Génération… {avancement.fait}/{avancement.total}
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                      <div
                        className="h-full bg-[#00236f] transition-all"
                        style={{ width: `${(avancement.fait / avancement.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
                {bilan && (
                  <>
                    {bilan.docs.length > 0 && (
                      <div className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5 text-green-700">
                          <CheckCircle2 className="h-4 w-4" />
                          {bilan.docs.length} document(s) généré(s)
                        </span>
                        <Button size="sm" onClick={handleZip} disabled={zipEnCours} className="bg-[#00236f] text-white hover:bg-[#1e3a8a]">
                          {zipEnCours ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Download className="h-4 w-4 mr-1.5" />}
                          Tout télécharger (.zip)
                        </Button>
                      </div>
                    )}
                    {bilan.erreurs.length > 0 && (
                      <ul className="space-y-1 text-xs text-red-700">
                        {bilan.erreurs.map((e, i) => (
                          <li key={i} className="flex gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                            <span>
                              <strong>{e.nom}</strong> — {e.error}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 text-xs text-zinc-500">
              {formState.selectedMissionId
                ? parIntervenant
                  ? "Un document sera généré par intervenant coché, avec les données de la mission, de l'étude et du client."
                  : "Le document sera généré avec les données de la mission, de l'étude, du client et de l'intervenant sélectionné."
                : "Le document sera généré avec les données de l'étude, du client et du suiveur."}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => dispatch({ type: "TOGGLE_MODAL", payload: false })}>
              {bilan ? "Fermer" : "Annuler"}
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !formState.selectedTemplateId || !!bilan}
              className="bg-[#00236f] text-white hover:bg-[#1e3a8a]"
            >
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              {groupe ? `Générer ${idsChoisis.length} documents` : "Générer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DocumentViewer
        open={!!previewDoc}
        onOpenChange={(open) => !open && setPreviewDoc(null)}
        url={previewDoc?.url || null}
        downloadUrl={previewDoc?.downloadUrl || null}
        fileName={previewDoc?.name || null}
      />
    </div>
  )
}
