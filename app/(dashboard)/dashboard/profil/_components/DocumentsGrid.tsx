"use client"

import { useState, useCallback, useEffect } from "react"
import {
  Upload,
  FileText,
  Trash2,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle,
  IdCard,
  GraduationCap,
  HeartPulse,
  Wallet,
  Landmark,
  Eye,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import type { DocumentPersonne, DocumentType } from "@/types/database.types"
import {
  VALID_DOC_TYPES,
  DOC_TYPE_LABELS,
  MAX_FILE_SIZE,
  ACCEPTED_FILE_TYPES,
} from "@/app/(dashboard)/dashboard/profil/_lib/schemas"
import type { LucideIcon } from "lucide-react"

const DOC_ICONS: Record<string, LucideIcon> = {
  carte_identite: IdCard,
  carte_etudiante: GraduationCap,
  carte_vitale: HeartPulse,
  preuve_lydia: Wallet,
  rib: Landmark,
}

interface DocumentsGridProps {
  targetUserId?: string
  readOnly?: boolean
}

export function DocumentsGrid({ targetUserId, readOnly = false }: DocumentsGridProps) {
  const [documents, setDocuments] = useState<DocumentPersonne[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    try {
      const url = targetUserId
        ? `/api/profil/documents?targetUserId=${targetUserId}`
        : "/api/profil/documents"
      const res = await fetch(url)
      const data = await res.json()
      if (res.ok) {
        setDocuments(data.documents || [])
      }
    } catch {
      console.error("Failed to fetch documents")
    } finally {
      setLoading(false)
    }
  }, [targetUserId])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleUpload = async (docType: string, file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Le fichier ne doit pas dépasser 10 Mo")
      return
    }
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      toast.error("Format accepté : JPEG, PNG, WebP, PDF")
      return
    }

    setUploading(docType)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("docType", docType)

      const res = await fetch("/api/profil/documents", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Erreur lors de l'upload")
        return
      }

      toast.success(`${DOC_TYPE_LABELS[docType]} uploadé(e)`)
      fetchDocuments()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setUploading(null)
    }
  }

  const handleDelete = async (doc: DocumentPersonne) => {
    setDeleting(doc.id)
    try {
      const res = await fetch(`/api/profil/documents/${doc.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const data = await res.json()
        toast.error(data.error || "Erreur lors de la suppression")
        return
      }

      toast.success("Document supprimé")
      fetchDocuments()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setDeleting(null)
    }
  }

  const handleView = async (doc: DocumentPersonne) => {
    try {
      const res = await fetch("/api/profil/documents/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath: doc.file_path }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Erreur")
        return
      }

      window.open(data.url, "_blank")
    } catch {
      toast.error("Erreur réseau")
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-48 rounded-xl bg-white border border-border animate-pulse"
          />
        ))}
      </div>
    )
  }

  const docMap = new Map<string, DocumentPersonne>()
  documents.forEach((d) => docMap.set(d.type, d))

  return (
    <div>
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <h2 className="font-manrope font-bold text-[#00236f] text-base">Mes documents</h2>
        <a
          href="https://filigrane.beta.gouv.fr/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#00236f] text-white text-xs font-semibold hover:bg-[#1e3a8a] transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Filigrane
        </a>
      </div>

      <div className="p-3 space-y-2">
        {VALID_DOC_TYPES.map((docType) => {

          const existing = docMap.get(docType)
          const Icon = DOC_ICONS[docType] || FileText
          const isUploading = uploading === docType
          const isDeleting = deleting === existing?.id

          return (
            <div
              key={docType}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${
                existing
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-slate-200 bg-white"
              }`}
            >
              {/* Left: icon + label + badge */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`h-8 w-8 rounded-lg shrink-0 flex items-center justify-center ${
                    existing ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    {DOC_TYPE_LABELS[docType]}
                  </p>
                  {existing ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                      <span className="text-xs text-emerald-600 truncate max-w-[100px]">
                        {existing.file_name}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 mt-0.5">
                      <AlertCircle className="h-3 w-3 text-amber-400 shrink-0" />
                      <span className="text-xs text-amber-500">Manquant</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {existing && (
                  <button
                    onClick={() => handleView(existing)}
                    title="Consulter"
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-[#00236f] hover:bg-[#d0d8ff] transition-colors"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                )}
                {existing && !readOnly && (
                  <button
                    onClick={() => handleDelete(existing)}
                    disabled={isDeleting}
                    title="Supprimer"
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    {isDeleting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
                {!readOnly && (
                  <label
                    title={existing ? "Remplacer" : "Uploader"}
                    className={`h-7 w-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors ${
                      existing
                        ? "text-slate-400 hover:bg-slate-100"
                        : "bg-[#00236f] text-white hover:bg-[#1e3a8a]"
                    } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    {isUploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp,.pdf"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleUpload(docType, file)
                        e.target.value = ""
                      }}
                      disabled={isUploading}
                    />
                  </label>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
