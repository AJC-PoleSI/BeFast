"use client"

import { useState } from "react"
import { Upload, Trash2, FileText } from "lucide-react"
import { toast } from "sonner"
import type { DocumentPersonne, DocumentType } from "@/types/database.types"
import {
  DOC_TYPE_LABELS,
  MAX_FILE_SIZE,
  ACCEPTED_FILE_TYPES,
} from "@/app/(dashboard)/dashboard/profil/_lib/schemas"

interface DocumentSlotProps {
  docType: DocumentType
  document: DocumentPersonne | null
  onDocumentsChange: () => void
  readOnly?: boolean
}

export function DocumentSlot({
  docType,
  document,
  onDocumentsChange,
  readOnly,
}: DocumentSlotProps) {
  const [uploading, setUploading] = useState(false)

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly || !e.target.files?.[0]) return

    const file = e.target.files[0]
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Fichier trop volumineux")
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("docType", docType)

      const res = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) throw new Error("Upload failed")
      toast.success("Document uploadeé")
      onDocumentsChange()
    } catch (err) {
      toast.error("Erreur lors de l'upload")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!document || readOnly) return

    try {
      const res = await fetch(`/api/documents/${document.id}`, {
        method: "DELETE",
      })
      if (!res.ok) throw new Error("Delete failed")
      toast.success("Document supprimé")
      onDocumentsChange()
    } catch (err) {
      toast.error("Erreur lors de la suppression")
    }
  }

  return (
    <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
      <div className="flex items-center gap-3">
        <FileText className="w-5 h-5 text-slate-400" />
        <span className="text-sm font-medium">{DOC_TYPE_LABELS[docType]}</span>
        {document && <span className="text-xs text-green-600">✓ Uploadé</span>}
      </div>

      <div className="flex items-center gap-2">
        {!readOnly && (
          <>
            <input
              type="file"
              id={`doc-${docType}`}
              onChange={handleUpload}
              disabled={uploading}
              accept={ACCEPTED_FILE_TYPES.join(",")}
              className="hidden"
            />
            <label htmlFor={`doc-${docType}`}>
              <button
                disabled={uploading || readOnly}
                className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                {uploading ? "Upload..." : "Upload"}
              </button>
            </label>

            {document && (
              <button
                onClick={handleDelete}
                className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
