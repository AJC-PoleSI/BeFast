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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold">Mes documents</h3>
        <a
          href="https://filigrane.beta.gouv.fr/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-blue hover:underline transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Ajouter un filigrane
        </a>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {VALID_DOC_TYPES.map((docType) => {
          const existing = docMap.get(docType)
          const Icon = DOC_ICONS[docType] || FileText
          const isUploading = uploading === docType
          const isDeleting = deleting === existing?.id

          return (
            <div
              key={docType}
              className={`group relative rounded-xl border-2 transition-all duration-300 ${
                existing
                  ? "border-emerald-200 bg-gradient-to-br from-emerald-50/50 to-white shadow-sm hover:shadow-md"
                  : "border-dashed border-border bg-white hover:border-gold/50 hover:shadow-sm"
              }`}
            >
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      existing
                        ? "bg-emerald-100 text-emerald-600"
                        : "bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  {existing && (
                    <div className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                      <CheckCircle2 className="h-3 w-3" />
                      Uploadé
                    </div>
                  )}
                  {!existing && (
                    <div className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                      <AlertCircle className="h-3 w-3" />
                      Manquant
                    </div>
                  )}
                </div>

                <h4 className="font-medium text-sm mb-1">
                  {DOC_TYPE_LABELS[docType]}
                </h4>

                {existing && (
                  <p className="text-xs text-muted-foreground truncate mb-3">
                    {existing.file_name}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-auto">
                  {existing && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleView(existing)}
                        className="h-8 text-xs text-blue hover:text-blue/80"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Voir
                      </Button>
                      {!readOnly && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(existing)}
                          disabled={isDeleting}
                          className="h-8 text-xs text-destructive hover:text-destructive/80"
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                          )}
                          Supprimer
                        </Button>
                      )}
                    </>
                  )}

                  {!readOnly && (
                    <label
                      className={`inline-flex items-center gap-1 h-8 px-3 text-xs font-medium rounded-md cursor-pointer transition-colors ${
                        existing
                          ? "text-muted-foreground hover:bg-muted/50"
                          : "bg-gold text-navy hover:bg-gold/90"
                      } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
                    >
                      {isUploading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Upload className="h-3.5 w-3.5" />
                      )}
                      {existing ? "Remplacer" : "Uploader"}
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
