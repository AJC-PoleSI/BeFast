"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, FileText, Download, Trash2, Sparkles, Loader2, CheckCircle2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  listEntityDocuments,
  listTemplates,
  deleteGeneratedDocument,
  listMissionIntervenants,
} from "@/lib/actions/documents"
import { getMission } from "@/lib/actions/missions"
import { getEtude } from "@/lib/actions/etudes"
import { useUser } from "@/hooks/useUser"
import { canEditEtude } from "@/lib/auth/permissions"
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
import { documentDownloadName } from "@/lib/documents/download-name"
import { IntervenantConcerne } from "@/components/documents/IntervenantConcerne"
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

export default function MissionDocumentsPage() {
  const params = useParams()
  const missionId = params.missionId as string
  const { profile } = useUser()
  const [templates, setTemplates] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [intervenants, setIntervenants] = useState<any[]>([])
  // Un seul intervenant pour un modèle « classique », plusieurs pour un modèle
  // propre à chaque intervenant (RDM, avenants, BV…) : un document par personne cochée.
  const [selectedIntervenantIds, setSelectedIntervenantIds] = useState<string[]>([])
  const [avancement, setAvancement] = useState<{ fait: number; total: number } | null>(null)
  const [bilan, setBilan] = useState<{
    docs: any[]
    erreurs: { nom: string; error: string }[]
    nomArchive: string
  } | null>(null)
  const [zipEnCours, setZipEnCours] = useState(false)
  const [filtreIntervenant, setFiltreIntervenant] = useState("")
  const [etudeNumero, setEtudeNumero] = useState("")
  // Passages propres à un avenant (objet, nouvelle date, motifs…), saisis ici plutôt que dans Word.
  const [champsAvenant, setChampsAvenant] = useState<ValeursAvenant>({})
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [initialLoadDone, setInitialLoadDone] = useState(false)
  const [etudeAcces, setEtudeAcces] = useState<{
    created_by: string | null
    suiveurs: { id: string }[]
  }>({ created_by: null, suiveurs: [] })
  // Générer un document = créateur de l'étude, ses suiveurs (chefs de projet),
  // Pôle SI, admin — même règle que la modification de l'étude (canEditEtude).
  const canGenerate = canEditEtude(profile, etudeAcces)

  const [previewDoc, setPreviewDoc] = useState<{ url: string; downloadUrl: string; name: string } | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [tRes, dRes, iRes, mRes] = await Promise.all([
      listTemplates(),
      listEntityDocuments("mission", missionId),
      listMissionIntervenants(missionId),
      getMission(missionId),
    ])
    setTemplates((tRes as any).data || [])
    setDocs((dRes as any).data || [])

    const intervenantsList = (iRes as any).data || []
    setIntervenants(intervenantsList)
    if (intervenantsList.length === 1) {
      setSelectedIntervenantIds((ids) => (ids.length ? ids : [intervenantsList[0].id]))
    }

    const etudeId = (mRes as any).data?.etude_id ?? null
    if (etudeId) {
      const eRes = await getEtude(etudeId)
      setEtudeAcces({
        created_by: (eRes as any).data?.created_by ?? null,
        suiveurs: (eRes as any).data?.suiveurs ?? [],
      })
      setEtudeNumero((eRes as any).data?.numero ?? "")
    }

    setLoading(false)
    setInitialLoadDone(true)
  }, [missionId])

  useEffect(() => {
    refresh()
  }, [missionId])

  // Après une génération, seule la liste des documents change.
  const refreshDocs = useCallback(async () => {
    const dRes = await listEntityDocuments("mission", missionId)
    setDocs((dRes as any).data || [])
  }, [missionId])

  const modeleChoisi = templates.find((t) => t.id === selectedTemplateId)
  const parIntervenant = CATEGORIES_PAR_INTERVENANT.has(modeleChoisi?.category)
  const codeModele = modeleChoisi ? CATEGORY_CODES[modeleChoisi.category] : undefined
  const groupe = parIntervenant && selectedIntervenantIds.length > 1
  const categorieAvenant = CATEGORIES_AVENANT.has(modeleChoisi?.category) ? (modeleChoisi.category as string) : null

  // Forme du nom qui sera donné au document (« 26 AV## RDM## 03 »), rappelée sous le modèle.
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

  // Dernier RDM de chaque intervenant (docs est trié du plus récent au plus ancien).
  const rdmParIntervenant = new Map<string, string>()
  for (const d of docs) {
    const cat = templates.find((t) => t.id === d.template_id)?.category
    if (cat === "rdm" && d.intervenant_id && !rdmParIntervenant.has(d.intervenant_id)) {
      rdmParIntervenant.set(d.intervenant_id, segmentRdmParent(d.file_name))
    }
  }
  const exigeRdm = !!codeModele?.parentRdm
  const intervenantsAffiches = intervenants.filter((p) =>
    `${p.prenom} ${p.nom}`.toLowerCase().includes(filtreIntervenant.trim().toLowerCase())
  )

  const ouvrirModale = () => {
    setBilan(null)
    setAvancement(null)
    setFiltreIntervenant("")
    setShowGenerateModal(true)
  }

  const handleGenerate = async () => {
    if (!selectedTemplateId) {
      toast.error("Sélectionnez un modèle")
      return
    }
    if (categorieAvenant) {
      if (selectedIntervenantIds.length === 0) {
        toast.error("Cochez au moins un intervenant")
        return
      }
      const erreurs = validerChampsAvenant(categorieAvenant, champsAvenant)
      if (erreurs.length > 0) {
        toast.error(erreurs[0])
        return
      }
    }
    if (groupe) return handleGenerateGroupe()
    setGenerating(true)
    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_id: selectedTemplateId,
          scope: "mission",
          entity_id: missionId,
          intervenant_id: selectedIntervenantIds[0] || undefined,
          champs: categorieAvenant ? champsAvenant : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) toast.error(json?.error || "Erreur")
      else {
        toast.success("Document généré")
        // Téléchargement immédiat sans ouvrir d'onglet (un popup serait bloqué après l'attente).
        declencherTelechargement(`/api/documents/${json.data.id}/download`)
        setShowGenerateModal(false)
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
    const ordre = intervenants.filter((p) => selectedIntervenantIds.includes(p.id))
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
            template_id: selectedTemplateId,
            mission_id: missionId,
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
      nomArchive: `${modeleChoisi?.name ?? "Documents"} - ${numeroEtudeCourt(etudeNumero) || "mission"}`.replace(/[\\/:*?"<>|]/g, ""),
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

  if (!initialLoadDone) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 text-[#00236f] mx-auto mb-4">
            <div className="border-4 border-[#00236f]/20 border-t-[#00236f] rounded-full h-8 w-8"></div>
          </div>
          <p className="text-sm text-muted-foreground">Chargement des documents...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Link href={`/missions/${missionId}`}>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Retour à la mission
        </Button>
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-[#00236f] mb-1">Documents de la mission</h1>
        <p className="text-sm text-zinc-500">Générez des documents à partir des modèles DOCX importés.</p>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" /> Générer un document
          </h2>
          {canGenerate && (
            <Button
              onClick={ouvrirModale}
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
            Aucun document généré pour cette mission.
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

      {/* Generate document modal */}
      <Dialog open={showGenerateModal} onOpenChange={(o) => !o && setShowGenerateModal(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogClose onClose={() => setShowGenerateModal(false)} />
          <DialogHeader>
            <DialogTitle>Générer un document</DialogTitle>
            <DialogDescription>
              Sélectionnez le modèle et, pour un document propre à chaque intervenant, les personnes concernées.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Template dropdown */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Label>Modèle de document *</Label>
                <NomenclatureAide />
              </div>
              <select
                className="w-full h-10 px-3 rounded-md border border-input text-sm bg-white"
                value={selectedTemplateId}
                onChange={(e) => {
                  setSelectedTemplateId(e.target.value)
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

            {/* Intervenants */}
            <div className="space-y-2">
              {parIntervenant ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <Label>
                      Intervenants{" "}
                      <span className="font-normal text-zinc-500">
                        ({selectedIntervenantIds.length}/{intervenants.length} — un document par personne)
                      </span>
                    </Label>
                    {intervenants.length > 1 && (
                      <div className="flex gap-3 text-xs">
                        <button
                          type="button"
                          className="text-[#00236f] underline hover:no-underline"
                          onClick={() => setSelectedIntervenantIds(intervenants.map((p) => p.id))}
                        >
                          Tout sélectionner
                        </button>
                        <button
                          type="button"
                          className="text-zinc-500 underline hover:no-underline"
                          onClick={() => setSelectedIntervenantIds([])}
                        >
                          Aucun
                        </button>
                      </div>
                    )}
                  </div>
                  {intervenants.length > 8 && (
                    <input
                      type="search"
                      value={filtreIntervenant}
                      onChange={(e) => setFiltreIntervenant(e.target.value)}
                      placeholder="Rechercher un intervenant…"
                      className="w-full h-9 px-3 rounded-md border border-input text-sm bg-white"
                    />
                  )}
                  {intervenants.length > 0 ? (
                    <div className="max-h-56 overflow-y-auto rounded-md border border-input divide-y">
                      {intervenantsAffiches.map((p) => {
                        const rdm = rdmParIntervenant.get(p.id)
                        return (
                          <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-1.5">
                            <Checkbox
                              isSelected={selectedIntervenantIds.includes(p.id)}
                              onChange={() =>
                                setSelectedIntervenantIds((ids) =>
                                  ids.includes(p.id) ? ids.filter((i) => i !== p.id) : [...ids, p.id]
                                )
                              }
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
                    <p className="text-sm text-zinc-500">Aucun intervenant accepté sur cette mission.</p>
                  )}
                </>
              ) : (
                <>
                  <Label>Intervenant (optionnel)</Label>
                  {intervenants.length > 0 ? (
                    <select
                      className="w-full h-10 px-3 rounded-md border border-input text-sm bg-white"
                      value={selectedIntervenantIds[0] ?? ""}
                      onChange={(e) => setSelectedIntervenantIds(e.target.value ? [e.target.value] : [])}
                    >
                      <option value="">-- Aucun / Laisser vide --</option>
                      {intervenants.map((p) => (
                        <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm text-zinc-500">Aucun intervenant accepté sur cette mission.</p>
                  )}
                </>
              )}
            </div>

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
              {parIntervenant
                ? "Un document sera généré par intervenant coché, avec les données de cette mission, de son étude et du client."
                : "Le document sera généré avec les données de cette mission, de son étude, du client, et de l'intervenant sélectionné."}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowGenerateModal(false)}>
              {bilan ? "Fermer" : "Annuler"}
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !selectedTemplateId || !!bilan}
              className="bg-[#00236f] text-white hover:bg-[#1e3a8a]"
            >
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              {groupe ? `Générer ${selectedIntervenantIds.length} documents` : "Générer"}
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
