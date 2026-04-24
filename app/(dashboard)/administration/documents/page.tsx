"use client"

import { useEffect, useState, useRef } from "react"
import {
  FileText, Plus, Trash2, Download, Upload, Loader2, Search,
  X, Eye, RefreshCw, ChevronDown, ChevronRight, BookOpen, UserCheck,
  Tag, Clock, File,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog"
import { listTemplates, deleteTemplate } from "@/lib/actions/documents"

/* ─── Nomenclature ──────────────────────────────────────────── */

const CATEGORY_ETUDE = "etude_mission"
const CATEGORY_INTERVENANT = "intervenant_rdm"

const DOCUMENT_TYPES: {
  key: string
  label: string
  category: typeof CATEGORY_ETUDE | typeof CATEGORY_INTERVENANT
}[] = [
  // Cat 1 — Étude / Mission
  { key: "accord_confidentialite", label: "Accord de confidentialité Client", category: CATEGORY_ETUDE },
  { key: "avant_projet", label: "Avant-Projet", category: CATEGORY_ETUDE },
  { key: "bon_commande", label: "Bon de Commande", category: CATEGORY_ETUDE },
  { key: "convention_cadre", label: "Convention Cadre", category: CATEGORY_ETUDE },
  { key: "convention_client", label: "Convention Client", category: CATEGORY_ETUDE },
  { key: "convention_etude", label: "Convention d'Étude", category: CATEGORY_ETUDE },
  { key: "fiche_selection", label: "Fiche sélection", category: CATEGORY_ETUDE },
  { key: "pv_recette_final", label: "Procès Verbal de Recette Final", category: CATEGORY_ETUDE },
  { key: "pv_recette_intermediaire", label: "Procès Verbal de Recette Intermédiaire", category: CATEGORY_ETUDE },
  { key: "avenant_mission", label: "Avenant de mission", category: CATEGORY_ETUDE },
  // Cat 2 — Intervenant / RDM
  { key: "rdm", label: "Récapitulatif de mission (RDM)", category: CATEGORY_INTERVENANT },
  { key: "avenant_rdm", label: "Avenant au RDM", category: CATEGORY_INTERVENANT },
  { key: "avenant_rupture_rdm", label: "Avenant de Rupture RDM", category: CATEGORY_INTERVENANT },
  { key: "bulletin_versement", label: "Bulletin de Versement", category: CATEGORY_INTERVENANT },
  { key: "questionnaire_satisfaction", label: "Questionnaire de satisfaction", category: CATEGORY_INTERVENANT },
  { key: "rapport_pedagogique", label: "Rapport pédagogique", category: CATEGORY_INTERVENANT },
]

const CAT_ETUDE_DOCS = DOCUMENT_TYPES.filter((d) => d.category === CATEGORY_ETUDE)
const CAT_INTERVENANT_DOCS = DOCUMENT_TYPES.filter((d) => d.category === CATEGORY_INTERVENANT)

/* ─── Component ─────────────────────────────────────────────── */

export default function DocumentTemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  // Upload modal
  const [showUpload, setShowUpload] = useState(false)
  const [uploadTarget, setUploadTarget] = useState<string | null>(null) // document type key
  const [replaceId, setReplaceId] = useState<string | null>(null) // template id to replace
  const [form, setForm] = useState({ name: "", description: "", file: null as File | null })
  const [uploading, setUploading] = useState(false)

  // Detail panel
  const [selectedTemplate, setSelectedTemplate] = useState<any | null>(null)

  // Sections collapsed state
  const [collapsedEtude, setCollapsedEtude] = useState(false)
  const [collapsedIntervenant, setCollapsedIntervenant] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const refresh = async () => {
    setLoading(true)
    const res = await listTemplates()
    setTemplates((res as any).data || [])
    setLoading(false)
  }

  useEffect(() => {
    refresh()
  }, [])

  /* ─── Helpers ─────────────────────── */

  // Find the uploaded template for a given document type key
  function getTemplateForType(typeKey: string) {
    return templates.find((t) => t.category === typeKey)
  }

  /* ─── Upload / Replace ──────────── */

  function openUploadFor(typeKey: string, existingId?: string) {
    const docType = DOCUMENT_TYPES.find((d) => d.key === typeKey)
    setUploadTarget(typeKey)
    setReplaceId(existingId || null)
    setForm({ name: docType?.label || "", description: "", file: null })
    setShowUpload(true)
  }

  const handleUpload = async () => {
    if (!form.file) return toast.error("Fichier DOCX requis")
    setUploading(true)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)

    try {
      // If replacing, delete old one first
      if (replaceId) {
        await deleteTemplate(replaceId)
      }

      const fd = new FormData()
      fd.append("file", form.file)
      fd.append("name", form.name)
      fd.append("description", form.description)
      fd.append("category", uploadTarget || "")

      const res = await fetch("/api/admin/templates", {
        method: "POST",
        body: fd,
        signal: controller.signal,
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.error || "Erreur upload")
      } else {
        toast.success(
          `Modèle importé — ${json.data?.placeholders?.length || 0} balise(s) détectée(s)`
        )
        setShowUpload(false)
        setForm({ name: "", description: "", file: null })
        setUploadTarget(null)
        setReplaceId(null)
        refresh()
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        toast.error("Délai d'attente dépassé — réessayez avec un fichier plus petit")
      } else {
        toast.error("Erreur réseau — vérifiez votre connexion")
      }
    } finally {
      clearTimeout(timeout)
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce modèle ?")) return
    const res = await deleteTemplate(id)
    if ((res as any).error) toast.error((res as any).error)
    else {
      toast.success("Supprimé")
      if (selectedTemplate?.id === id) setSelectedTemplate(null)
      refresh()
    }
  }

  /* ─── Filter ──────────────────────── */

  function filterTypes(types: typeof DOCUMENT_TYPES) {
    if (!search.trim()) return types
    const q = search.toLowerCase()
    return types.filter((t) => {
      const tpl = getTemplateForType(t.key)
      const haystack = `${t.label} ${t.key} ${tpl?.name || ""} ${tpl?.description || ""}`.toLowerCase()
      return haystack.includes(q)
    })
  }

  const filteredEtude = filterTypes(CAT_ETUDE_DOCS)
  const filteredIntervenant = filterTypes(CAT_INTERVENANT_DOCS)

  /* ─── Render document row ──────── */

  function renderDocRow(docType: (typeof DOCUMENT_TYPES)[0]) {
    const tpl = getTemplateForType(docType.key)
    const isSelected = selectedTemplate?.id === tpl?.id && tpl

    return (
      <div
        key={docType.key}
        className={`group flex items-center gap-4 px-4 py-3 rounded-xl border transition-all cursor-pointer ${
          isSelected
            ? "border-[#00236f] bg-[#00236f]/[0.04] shadow-sm"
            : "border-slate-200 bg-white hover:border-[#00236f]/30 hover:shadow-sm"
        }`}
        onClick={() => tpl && setSelectedTemplate(tpl)}
      >
        {/* Icon */}
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
            tpl
              ? "bg-emerald-50 text-emerald-600"
              : "bg-slate-100 text-slate-400"
          }`}
        >
          <FileText className="w-5 h-5" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-semibold text-slate-800 truncate">
              {docType.label}
            </span>
            {tpl ? (
              <Badge className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                Importé
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200 shrink-0">
                Non importé
              </Badge>
            )}
          </div>
          {tpl && (
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {(tpl.placeholders || []).length} balise(s)
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(tpl.created_at).toLocaleDateString("fr-FR")}
              </span>
              <span className="flex items-center gap-1 truncate">
                <File className="w-3 h-3" />
                {tpl.file_name}
              </span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          {tpl ? (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedTemplate(tpl)
                }}
                className="p-2 rounded-lg text-slate-500 hover:text-[#00236f] hover:bg-[#00236f]/10 transition-colors"
                title="Voir les balises"
              >
                <Eye className="w-4 h-4" />
              </button>
              <a
                href={`/api/admin/templates/${tpl.id}/download`}
                onClick={(e) => e.stopPropagation()}
                className="p-2 rounded-lg text-slate-500 hover:text-[#00236f] hover:bg-[#00236f]/10 transition-colors"
                title="Exporter / Télécharger"
              >
                <Download className="w-4 h-4" />
              </a>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  openUploadFor(docType.key, tpl.id)
                }}
                className="p-2 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                title="Importer une nouvelle version"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(tpl.id)
                }}
                className="p-2 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Supprimer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation()
                openUploadFor(docType.key)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#00236f] hover:bg-[#1e3a8a] transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              Importer
            </button>
          )}
        </div>
      </div>
    )
  }

  /* ─── Category section ────────────── */

  function renderCategory(
    title: string,
    description: string,
    icon: React.ReactNode,
    docs: typeof DOCUMENT_TYPES,
    collapsed: boolean,
    setCollapsed: (v: boolean) => void,
    accentColor: string,
  ) {
    const total = docs.length
    const imported = docs.filter((d) => getTemplateForType(d.key)).length

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-slate-50/50 transition-colors"
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accentColor}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="font-manrope font-bold text-[#00236f] text-base">{title}</h2>
              <span className="text-xs text-slate-400 font-medium">
                {imported}/{total} importé(s)
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{description}</p>
          </div>
          {/* Progress bar */}
          <div className="w-24 shrink-0">
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${total > 0 ? (imported / total) * 100 : 0}%` }}
              />
            </div>
          </div>
          {collapsed ? (
            <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-400 shrink-0" />
          )}
        </button>

        {/* Body */}
        {!collapsed && (
          <div className="px-6 pb-5 space-y-2">
            {docs.length === 0 ? (
              <p className="text-sm text-slate-400 italic py-4 text-center">
                Aucun résultat pour cette recherche.
              </p>
            ) : (
              docs.map(renderDocRow)
            )}
          </div>
        )}
      </div>
    )
  }

  /* ─── Detail Panel ───────────────── */

  function renderDetailPanel() {
    if (!selectedTemplate) return null

    const docType = DOCUMENT_TYPES.find((d) => d.key === selectedTemplate.category)
    const placeholders: string[] = selectedTemplate.placeholders || []

    // Group placeholders by prefix
    const groups: Record<string, string[]> = {}
    for (const p of placeholders) {
      const [prefix] = p.split(".")
      if (!groups[prefix]) groups[prefix] = []
      groups[prefix].push(p)
    }

    return (
      <div className="fixed inset-y-0 right-0 w-[420px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="min-w-0">
            <h3 className="font-manrope font-bold text-[#00236f] text-sm truncate">
              {docType?.label || selectedTemplate.name}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{selectedTemplate.file_name}</p>
          </div>
          <button
            onClick={() => setSelectedTemplate(null)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Meta */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Clock className="w-3.5 h-3.5" />
              Importé le {new Date(selectedTemplate.created_at).toLocaleDateString("fr-FR", {
                day: "numeric", month: "long", year: "numeric",
              })}
            </div>
            {selectedTemplate.description && (
              <p className="text-sm text-slate-600">{selectedTemplate.description}</p>
            )}
          </div>

          {/* Placeholders */}
          <div>
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-[#00236f]" />
              Balises détectées ({placeholders.length})
            </h4>

            {placeholders.length === 0 ? (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
                <p className="text-sm text-slate-400 italic">Aucune balise détectée dans ce document.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(groups).map(([prefix, items]) => (
                  <div key={prefix} className="rounded-xl bg-slate-50 border border-slate-200 overflow-hidden">
                    <div className="px-3 py-2 bg-slate-100/80 border-b border-slate-200">
                      <span className="text-xs font-bold text-[#00236f] uppercase tracking-wider">
                        {prefix}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-2">
                        ({items.length})
                      </span>
                    </div>
                    <div className="p-3 flex flex-wrap gap-1.5">
                      {items.map((p) => (
                        <span
                          key={p}
                          className="inline-flex items-center text-[11px] font-mono bg-white text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 shadow-sm"
                        >
                          <span className="text-[#00236f]/40">{"{"}</span>
                          {p}
                          <span className="text-[#00236f]/40">{"}"}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center gap-2">
          <a
            href={`/api/admin/templates/${selectedTemplate.id}/download`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#00236f] bg-[#00236f]/10 rounded-xl hover:bg-[#00236f]/20 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exporter
          </a>
          <button
            onClick={() => {
              const cat = selectedTemplate.category
              openUploadFor(cat, selectedTemplate.id)
              setSelectedTemplate(null)
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-amber-700 bg-amber-50 rounded-xl hover:bg-amber-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Remplacer
          </button>
          <button
            onClick={() => {
              handleDelete(selectedTemplate.id)
            }}
            className="p-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
            title="Supprimer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  /* ─── Main Render ────────────────── */

  return (
    <>
      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .animate-slide-in {
          animation: slideIn 0.25s ease-out;
        }
      `}</style>

      <div className="p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-manrope font-black text-[#00236f]">Modèles de Documents</h1>
            <p className="text-slate-500 text-sm mt-1">
              Gérez les modèles DOCX utilisés pour la génération automatique de documents.
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="mb-6 relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un modèle…"
            className="pl-9"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-[#00236f]" />
          </div>
        ) : (
          <div className="space-y-6">
            {renderCategory(
              "Documents d'Étude / de Mission",
              "Documents portant sur la mission globale ou la relation client. Ne nécessitent pas de RDM ni de nom d'intervenant.",
              <BookOpen className="w-5 h-5 text-[#00236f]" />,
              filteredEtude,
              collapsedEtude,
              setCollapsedEtude,
              "bg-[#00236f]/10",
            )}

            {renderCategory(
              "Documents d'Intervenant / RDM",
              "Documents liant un étudiant intervenant à une mission spécifique. Nécessitent le numéro d'étude, le numéro de RDM et le nom de l'intervenant.",
              <UserCheck className="w-5 h-5 text-emerald-600" />,
              filteredIntervenant,
              collapsedIntervenant,
              setCollapsedIntervenant,
              "bg-emerald-50",
            )}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {renderDetailPanel()}

      {/* Backdrop when panel is open */}
      {selectedTemplate && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={() => setSelectedTemplate(null)}
        />
      )}

      {/* Upload / Replace modal */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-lg">
          <DialogClose onClose={() => setShowUpload(false)} />
          <DialogHeader>
            <DialogTitle>
              {replaceId ? "Remplacer le modèle DOCX" : "Importer un modèle DOCX"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            {uploadTarget && (
              <div className="rounded-lg bg-[#00236f]/[0.05] border border-[#00236f]/20 px-3 py-2">
                <span className="text-xs font-semibold text-[#00236f]">
                  {DOCUMENT_TYPES.find((d) => d.key === uploadTarget)?.label}
                </span>
                {replaceId && (
                  <span className="text-xs text-amber-600 ml-2">— remplacement</span>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Fichier .docx *</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
                className="block w-full text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Convention d'Étude"
              />
            </div>
            <div className="space-y-2">
              <Label>Description (optionnel)</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Notes sur ce modèle…"
              />
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
              <strong>Balises disponibles</strong> :<br />
              <code>{"{etude.nom}"}</code>, <code>{"{etude.numero}"}</code>, <code>{"{client.nom}"}</code>,{" "}
              <code>{"{suiveur.prenom}"}</code>, <code>{"{mission.nom}"}</code>,{" "}
              <code>{"{intervenant.prenom}"}</code>, <code>{"{intervenant.nom}"}</code>,{" "}
              <code>{"{president.nom_complet}"}</code>, <code>{"{structure.raison_sociale}"}</code>,{" "}
              <code>{"{date}"}</code>, <code>{"{annee}"}</code>.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowUpload(false)}>Annuler</Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !form.file}
              className="bg-gold text-navy font-semibold hover:bg-gold/90"
            >
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              {replaceId ? "Remplacer" : "Importer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
