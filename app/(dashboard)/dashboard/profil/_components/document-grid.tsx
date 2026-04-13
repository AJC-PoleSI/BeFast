"use client"

import { DocumentSlot } from "./document-slot"
import { VALID_DOC_TYPES } from "@/app/(dashboard)/dashboard/profil/_lib/schemas"
import type { DocumentPersonne, DocumentType } from "@/types/database.types"

interface DocumentGridProps {
  documents: DocumentPersonne[]
  onDocumentsChange: () => void
  readOnly?: boolean
}

export function DocumentGrid({ documents, onDocumentsChange, readOnly }: DocumentGridProps) {
  const docMap = new Map<DocumentType, DocumentPersonne>()
  documents.forEach((d) => docMap.set(d.type, d))

  return (
    <div className="space-y-2">
      {VALID_DOC_TYPES.map((docType) => (
        <DocumentSlot
          key={docType}
          docType={docType}
          document={docMap.get(docType) ?? null}
          onDocumentsChange={onDocumentsChange}
          readOnly={readOnly}
        />
      ))}
    </div>
  )
}
