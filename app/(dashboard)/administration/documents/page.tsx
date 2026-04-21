"use client"

import { useEffect, useState } from "react"
import { FileText, Plus, Trash2, Download, Upload, Loader2, Search } from "lucide-react"
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

const SCOPES = [
  { value: "etude", label: "Étude" },
  { value: "mission", label: "Mission" },
  { value: "personne", label: "Personne" },
  { value: "general", label: "Général" },
]

export default function DocumentTemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [showUpload, setShowUpload] = useState(false)

  const [form, setForm] = useState({
    name: "",
    description: "",
    scope: "etude",
    category: "",
    file: null as File | null,
  })
  const [uploading, setUploading] = useState(false)

  const refresh = async () => {
    setLoading(true)
    const res = await listTemplates()
    setTemplates((res as any).data || [])
    setLoading(false)
  }
  useEffect(() => {
    refresh()
  }, [])

  const handleUpload = async () => {
    if (!form.file) return toast.error("Fichier DOCX requis")
    if (!form.name.trim()) return toast.error("Nom requis")
    setUploading(true)
    const fd = new FormData()
    fd.append("file", form.file)
    fd.append("name", form.name)
    fd.append("description", form.description)
    fd.append("scope", form.scope)
    fd.append("category", form.category)

    const res = await fetch("/api/admin/templates", { method: "POST", body: fd })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json?.error || "Erreur upload")
    } else {
      toast.success(
        `Template importé — ${json.data?.placeholders?.length || 0} placeholder(s) détecté(s)`
      )
      setShowUpload(false)
      setForm({ name: "", description: "", scope: "etude", category: "", file: null })
      refresh()
    }
    setUploading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce modèle ?")) return
    const res = await deleteTemplate(id)
    if ((res as any).error) toast.error((res as any).error)
    else {
      toast.success("Supprimé")
      refresh()
    }
  }

  const filtered = templates.filter((t) =>
    (t.name + " " + (t.category || "") + " " + (t.description || ""))
      .toLowerCase()
      .includes(search.toLowerCase())
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Modèles de Documents</h1>
          <p className="text-slate-500 text-sm mt-1">
            Importez des modèles DOCX avec placeholders <code className="bg-slate-100 px-1 rounded">{"{etude.nom}"}</code>, <code className="bg-slate-100 px-1 rounded">{"{client.nom}"}</code>… pour génération automatique.
          </p>
        </div>
        <Button
          onClick={() => setShowUpload(true)}
          className="bg-[#00236f] text-white hover:bg-[#1e3a8a]"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nouveau modèle
        </Button>
      </div>

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
        <div className="text-center text-sm text-muted-foreground py-12">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
            <FileText className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">Aucun modèle</h3>
          <p className="text-slate-500 max-w-sm mx-auto text-sm">
            Importez un fichier <strong>.docx</strong> contenant des placeholders entre accolades.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-start justify-between gap-4 flex-wrap hover:border-[#00236f]/30 transition-colors"
            >
              <div className="flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <FileText className="h-4 w-4 text-[#00236f]" />
                  <span className="font-semibold text-sm">{t.name}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {SCOPES.find((s) => s.value === t.scope)?.label || t.scope}
                  </Badge>
                  {t.category && (
                    <Badge variant="outline" className="text-[10px] bg-gold/10 text-[#00236f] border-gold/30">
                      {t.category}
                    </Badge>
                  )}
                </div>
                {t.description && <p className="text-xs text-slate-500 mb-2">{t.description}</p>}
                <div className="flex flex-wrap gap-1 mt-2">
                  {(t.placeholders || []).map((p: string) => (
                    <span
                      key={p}
                      className="text-[10px] font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded"
                    >
                      {"{" + p + "}"}
                    </span>
                  ))}
                  {(!t.placeholders || t.placeholders.length === 0) && (
                    <span className="text-[10px] text-slate-400 italic">Aucun placeholder détecté</span>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-2">{t.file_name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={`/api/admin/templates/${t.id}/download`}
                  className="inline-flex items-center gap-1 text-xs text-[#00236f] hover:underline"
                >
                  <Download className="h-3.5 w-3.5" /> Télécharger
                </a>
                <button
                  onClick={() => handleDelete(t.id)}
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

      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="max-w-lg">
          <DialogClose onClose={() => setShowUpload(false)} />
          <DialogHeader>
            <DialogTitle>Importer un modèle DOCX</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="space-y-2">
              <Label>Fichier .docx *</Label>
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] || null })}
                className="block w-full text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Contrat prestation"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="À quoi sert ce modèle ?"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Portée</Label>
                <select
                  value={form.scope}
                  onChange={(e) => setForm({ ...form, scope: e.target.value })}
                  className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm"
                >
                  {SCOPES.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="Ex: contrat, facture"
                />
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
              <strong>Placeholders disponibles</strong> (selon la portée) :<br />
              <code>{"{etude.nom}"}</code>, <code>{"{etude.numero}"}</code>, <code>{"{etude.tarif_ht}"}</code>,{" "}
              <code>{"{client.nom}"}</code>, <code>{"{suiveur.prenom}"}</code>,{" "}
              <code>{"{mission.nom}"}</code>, <code>{"{mission.nb_jeh}"}</code>,{" "}
              <code>{"{personne.prenom}"}</code>, <code>{"{date}"}</code>, <code>{"{annee}"}</code>.
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowUpload(false)}>Annuler</Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !form.file || !form.name.trim()}
              className="bg-gold text-navy font-semibold hover:bg-gold/90"
            >
              {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-1.5 h-4 w-4" />}
              Importer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
