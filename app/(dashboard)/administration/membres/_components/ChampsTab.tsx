"use client"

import { useState, useEffect, useCallback } from "react"
import { useUser } from "@/hooks/useUser"
import { CustomFieldsTable } from "../../champs-personnalises/_components/CustomFieldsTable"
import { CustomFieldModal } from "../../champs-personnalises/_components/CustomFieldModal"
import type { CustomField as DBCustomField } from "@/types/database.types"

// Modal-friendly type (options as string array)
interface CustomFieldForm {
  id?: string
  name: string
  slug: string
  type: "text" | "select" | "date" | "number"
  required: boolean
  options?: string[]
  description?: string
  ordre?: number
}

export function ChampsTab() {
  const { isAdmin, loading } = useUser()
  const [fields, setFields] = useState<DBCustomField[]>([])
  const [fieldsLoading, setFieldsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedField, setSelectedField] = useState<CustomFieldForm | undefined>()

  const fetchFields = useCallback(async () => {
    setFieldsLoading(true)
    try {
      const res = await fetch("/api/admin/custom-fields")
      const data = await res.json()
      if (res.ok) {
        setFields(data.fields || [])
      }
    } catch {
      // silent
    } finally {
      setFieldsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!loading && isAdmin) {
      fetchFields()
    }
  }, [loading, isAdmin, fetchFields])

  const handleEdit = (field: DBCustomField) => {
    setSelectedField({
      ...field,
      description: field.description ?? undefined,
      options: field.options?.values || [],
    })
    setModalOpen(true)
  }

  const handleAddNew = () => {
    setSelectedField(undefined)
    setModalOpen(true)
  }

  const handleSuccess = () => {
    setSelectedField(undefined)
    fetchFields()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 bg-zinc-200 rounded-lg animate-pulse" />
        <div className="h-96 bg-zinc-200 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-zinc-500">Accès non autorisé</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-zinc-500">
          Champs supplémentaires des profils utilisateurs, réutilisables dans les templates de documents.
        </p>
        <button
          onClick={handleAddNew}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Créer un Champ
        </button>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex gap-3">
          <span className="material-symbols-outlined text-blue-600 flex-shrink-0">
            info
          </span>
          <div className="text-sm text-blue-900">
            <p className="font-medium mb-1">Utilisation dans les templates</p>
            <p>
              Utilisez la syntaxe <code className="bg-white px-1.5 py-0.5 rounded text-xs">{"{{slug_du_champ}}"}</code> pour insérer les valeurs des champs personnalisés dans vos templates de documents.
            </p>
          </div>
        </div>
      </div>

      {/* Table */}
      {fieldsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 bg-zinc-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : (
        <CustomFieldsTable
          fields={fields}
          onEdit={handleEdit}
          onRefresh={fetchFields}
        />
      )}

      {/* Modal */}
      <CustomFieldModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        field={selectedField}
        onSuccess={handleSuccess}
      />
    </div>
  )
}
