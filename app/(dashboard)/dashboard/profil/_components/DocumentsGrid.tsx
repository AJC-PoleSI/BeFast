"use client"

import { useState, useCallback, useEffect } from "react"
import {
  Upload,
  Download,
  FileText,
  Trash2,
  ExternalLink,
  Loader2,
  IdCard,
  GraduationCap,
  HeartPulse,
  Wallet,
  Landmark,
  Eye,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react"
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

interface StatusBadgeProps {
  status: "pending" | "approved" | "rejected"
}

function StatusBadge({ status }: StatusBadgeProps) {
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-emerald-600 font-bold">
        <CheckCircle2 className="h-3 w-3 shrink-0" />
        Validé
      </span>
    )
  }
  if (status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-red-500 font-bold">
        <XCircle className="h-3 w-3 shrink-0" />
        Refusé
      </span>
    )
  }
  // pending (orange)
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-orange-600 font-bold">
      <Clock className="h-3 w-3 shrink-0" />
      En attente
    </span>
  )
}

interface DocumentsGridProps {
  targetUserId?: string
  readOnly?: boolean
  isAdminView?: boolean
}

export function DocumentsGrid({ targetUserId, readOnly = false, isAdminView = false }: DocumentsGridProps) {
  const [documents, setDocuments] = useState<DocumentPersonne[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [updating, setUpdating] = useState<string | null>(null)

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

  const handleUpdateStatus = async (docId: string, status: "approved" | "rejected") => {
    setUpdating(docId)
    try {
      const res = await fetch(`/api/admin/documents/${docId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      })
      if (res.ok) {
        toast.success(status === "approved" ? "Document validé" : "Document refusé")
        fetchDocuments()
      } else {
        toast.error("Erreur lors de la mise à jour")
      }
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setUpdating(null)
    }
  }

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

      toast.success(`${DOC_TYPE_LABELS[docType]} uploadé(e) — en attente de validation`)
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

  const getSignedUrl = async (filePath: string): Promise<string | null> => {
    try {
      const res = await fetch("/api/profil/documents/signed-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePath }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || "Erreur"); return null }
      return data.url as string
    } catch {
      toast.error("Erreur réseau")
      return null
    }
  }

  const handleView = async (doc: DocumentPersonne) => {
    const url = await getSignedUrl(doc.file_path)
    if (url) window.open(url, "_blank")
  }

  const handleDownload = async (doc: DocumentPersonne) => {
    const url = await getSignedUrl(doc.file_path)
    if (!url) return
    const a = document.createElement("a")
    a.href = url
    a.download = doc.file_name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-14 rounded-xl bg-white border border-border animate-pulse"
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
        <h2 className="font-manrope font-bold text-[#00236f] text-base">
          {isAdminView ? "Documents soumis" : readOnly ? "Documents" : "Mes documents"}
        </h2>
        {!readOnly && !isAdminView && (
          <a
            href="https://filigrane.beta.gouv.fr/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#00236f] text-white text-xs font-semibold hover:bg-[#1e3a8a] transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Filigrane
          </a>
        )}
      </div>

      <div className="p-3 space-y-2">
        {VALID_DOC_TYPES.map((docType) => {
          const existing = docMap.get(docType)
          const Icon = DOC_ICONS[docType] || FileText
          const isUploading = uploading === docType
          const isDeleting = deleting === existing?.id
          const isUpdating = updating === existing?.id

          // Row border/bg based on status
          const rowStyle = existing
            ? existing.status === "approved"
              ? "border-emerald-200 bg-emerald-50/40"
              : existing.status === "rejected"
              ? "border-red-200 bg-red-50/30"
              : "border-orange-200 bg-orange-50/30" // pending (orange)
            : "border-slate-200 bg-white" // missing (white)

          // Icon bg/color
          const iconStyle = existing
            ? existing.status === "approved"
              ? "bg-emerald-100 text-emerald-600"
              : existing.status === "rejected"
              ? "bg-red-100 text-red-500"
              : "bg-orange-100 text-orange-600" // pending
            : "bg-slate-100 text-slate-400" // missing

          return (
            <div
              key={docType}
              className={`flex items-center justify-between px-3 py-2.5 rounded-xl border transition-all ${rowStyle}`}
            >
              {/* Left: icon + label + badge */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`h-8 w-8 rounded-lg shrink-0 flex items-center justify-center ${iconStyle}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-700 truncate">
                    {DOC_TYPE_LABELS[docType]}
                  </p>
                  <div className="flex items-center gap-1 mt-0.5">
                    {existing ? (
                      <StatusBadge status={existing.status} />
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-400 font-bold">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        Manquant
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: actions */}
              <div className="flex items-center gap-1 shrink-0 ml-2">
                {existing && (
                  <>
                    <button
                      onClick={() => handleView(existing)}
                      title="Consulter"
                      className="h-7 w-7 flex items-center justify-center rounded-lg text-[#00236f] hover:bg-[#d0d8ff] transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                    {isAdminView && existing.status === "pending" && (
                      <div className="flex items-center gap-1 ml-1 pl-1 border-l border-slate-200">
                        <button
                          onClick={() => handleUpdateStatus(existing.id, "approved")}
                          disabled={isUpdating}
                          title="Valider"
                          className="h-7 w-7 flex items-center justify-center rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                        >
                          {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(existing.id, "rejected")}
                          disabled={isUpdating}
                          title="Refuser"
                          className="h-7 w-7 flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    )}
                    {!isAdminView && (
                      <button
                        onClick={() => handleDownload(existing)}
                        title="Télécharger"
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </>
                )}
                {existing && !readOnly && !isAdminView && (
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
                {!readOnly && !isAdminView && (
                  <label
                    title={existing ? "Remplacer" : "Uploader"}
                    className={`h-7 w-7 flex items-center justify-center rounded-lg cursor-pointer transition-colors bg-[#00236f] text-white hover:bg-[#1e3a8a] ${
                      isUploading ? "opacity-50 pointer-events-none" : ""
                    }`}
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

