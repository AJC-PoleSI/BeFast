"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, FileText, Download, Trash2, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  listEntityDocuments,
  listTemplates,
  deleteGeneratedDocument,
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

export default function EtudeDocumentsPage() {
  const params = useParams()
  const etudeId = params.etudeId as string
  const [templates, setTemplates] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("")
  const [showGenerateModal, setShowGenerateModal] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    const [tRes, dRes] = await Promise.all([
      listTemplates(),
      listEntityDocuments("etude", etudeId),
    ])
    // Show ALL templates (no scope filtering)
    setTemplates((tRes as any).data || [])
    setDocs((dRes as any).data || [])
    setLoading(false)
  }, [etudeId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleGenerate = async () => {
    if (!selectedTemplateId) {
      toast.error("Sélectionnez un modèle")
      return
    }
    setGenerating(true)
    const res = await fetch("/api/documents/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ template_id: selectedTemplateId, scope: "etude", entity_id: etudeId }),
    })
    const json = await res.json()
    if (!res.ok) toast.error(json?.error || "Erreur")
    else {
      toast.success("Document généré")
      window.open(`/api/documents/${json.data.id}/download`, "_blank")
      setShowGenerateModal(false)
      setSelectedTemplateId("")
      refresh()
    }
    setGenerating(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce document ?")) return
    const res = await deleteGeneratedDocument(id)
    if ((res as any).error) toast.error((res as any).error)
    else {
      toast.success("Supprimé")
      refresh()
    }
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
            onClick={() => setShowGenerateModal(true)}
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
            Aucun modèle disponible. Importez-en depuis{" "}
            <Link href="/administration/documents" className="text-[#00236f] underline">
              Administration → Documents
            </Link>.
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
                className="bg-white rounded-xl border border-border shadow-sm p-3 flex items-center justify-between gap-3"
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
                    className="inline-flex items-center gap-1 text-xs text-[#00236f] hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" /> Télécharger
                  </a>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="text-red-500 hover:text-red-700"
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
        <DialogContent>
          <DialogClose onClose={() => setShowGenerateModal(false)} />
          <DialogHeader>
            <DialogTitle>Générer un document</DialogTitle>
            <DialogDescription>
              Sélectionnez le modèle à utiliser pour générer le document.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Template dropdown */}
            <div className="space-y-2">
              <Label>Modèle de document *</Label>
              <select
                className="w-full h-10 px-3 rounded-md border border-input text-sm bg-white"
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                <option value="">-- Sélectionnez un modèle --</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}{t.category ? ` (${t.category})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-xs text-slate-500">
              Le document sera généré avec les données de cette étude, du client, et du suiveur.
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowGenerateModal(false)}>Annuler</Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !selectedTemplateId}
              className="bg-[#00236f] text-white hover:bg-[#1e3a8a]"
            >
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
              Générer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
