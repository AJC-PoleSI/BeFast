"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, FileText, Download, Trash2, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  listEntityDocuments,
  listTemplates,
  deleteGeneratedDocument,
} from "@/lib/actions/documents"
import { createClient } from "@/lib/supabase/client"

export default function MissionDocumentsPage() {
  const params = useParams()
  const missionId = params.missionId as string
  const [templates, setTemplates] = useState<any[]>([])
  const [docs, setDocs] = useState<any[]>([])
  const [generating, setGenerating] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [intervenants, setIntervenants] = useState<any[]>([])
  const [selectedIntervenantId, setSelectedIntervenantId] = useState<string>("")

  const refresh = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const [tRes, dRes, cRes] = await Promise.all([
      listTemplates(),
      listEntityDocuments("mission", missionId),
      supabase
        .from("candidatures")
        .select("personnes(id, prenom, nom)")
        .eq("mission_id", missionId)
        .eq("statut", "acceptee")
    ])
    const allTpl = (tRes as any).data || []
    setTemplates(allTpl.filter((t: any) => t.scope === "mission" || t.scope === "general"))
    setDocs((dRes as any).data || [])
    
    const intervenantsList = (cRes.data || []).map((c: any) => c.personnes).filter(Boolean)
    setIntervenants(intervenantsList)
    if (intervenantsList.length === 1 && !selectedIntervenantId) {
      setSelectedIntervenantId(intervenantsList[0].id)
    }

    setLoading(false)
  }, [missionId, selectedIntervenantId])

  useEffect(() => {
    refresh()
  }, [refresh])

  const handleGenerate = async (templateId: string) => {
    setGenerating(templateId)
    const res = await fetch("/api/documents/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        template_id: templateId, 
        scope: "mission", 
        entity_id: missionId,
        intervenant_id: selectedIntervenantId || undefined 
      }),
    })
    const json = await res.json()
    if (!res.ok) toast.error(json?.error || "Erreur")
    else {
      toast.success("Document généré")
      window.open(`/api/documents/${json.data.id}/download`, "_blank")
      refresh()
    }
    setGenerating(null)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Supprimer ce document ?")) return
    const res = await deleteGeneratedDocument(id)
    if ((res as any).error) toast.error((res as any).error)
    else { toast.success("Supprimé"); refresh() }
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
        <p className="text-sm text-slate-500">Générez des documents à partir des modèles DOCX.</p>
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm p-5">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-gold" /> Générer à partir d&apos;un modèle
        </h2>

        {intervenants.length > 0 && (
          <div className="mb-4 p-3 bg-slate-50 border border-slate-100 rounded-lg space-y-2">
            <label className="text-xs font-medium text-slate-700 block">Intervenant à inclure dans les balises :</label>
            <select
              className="w-full max-w-sm h-9 px-3 rounded-md border border-input text-sm bg-white"
              value={selectedIntervenantId}
              onChange={(e) => setSelectedIntervenantId(e.target.value)}
            >
              <option value="">-- Sélectionner un intervenant --</option>
              {intervenants.map((p) => (
                <option key={p.id} value={p.id}>{p.prenom} {p.nom}</option>
              ))}
            </select>
          </div>
        )}
        {loading ? (
          <p className="text-xs text-muted-foreground">Chargement…</p>
        ) : templates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucun modèle mission disponible.{" "}
            <Link href="/administration/documents" className="text-[#00236f] underline">
              Gérer les modèles
            </Link>
          </p>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => handleGenerate(t.id)}
                disabled={generating === t.id}
                className="flex items-center gap-2 text-left p-3 rounded-lg border border-slate-200 hover:border-[#00236f]/40 hover:bg-[#00236f]/5 transition-all disabled:opacity-50"
              >
                {generating === t.id ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#00236f]" />
                ) : (
                  <FileText className="h-4 w-4 text-[#00236f]" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.name}</div>
                  {t.category && (
                    <Badge variant="outline" className="text-[10px] mt-0.5">{t.category}</Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
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
              <div key={d.id} className="bg-white rounded-xl border border-border shadow-sm p-3 flex items-center justify-between gap-3">
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
                  <a href={`/api/documents/${d.id}/download`} className="inline-flex items-center gap-1 text-xs text-[#00236f] hover:underline">
                    <Download className="h-3.5 w-3.5" /> Télécharger
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
    </div>
  )
}
