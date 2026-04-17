"use client"

import { useState, useEffect, useCallback } from "react"
import { useUser } from "@/hooks/useUser"
import { CustomFieldsTable } from "./_components/CustomFieldsTable"
import { CustomFieldModal } from "./_components/CustomFieldModal"

interface CustomField {
  id: string
  name: string
  slug: string
  type: "text" | "select" | "date" | "number"
  required: boolean
  options?: any
  description?: string
  ordre: number
}

export default function CustomFieldsPage() {
  const { isAdmin, loading } = useUser()
  const [fields, setFields] = useState<CustomField[]>([])
  const [fieldsLoading, setFieldsLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedField, setSelectedField] = useState<CustomField | undefined>()

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

  const handleEdit = (field: CustomField) => {
    setSelectedField({
      ...field,
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
        <div className="h-12 bg-slate-200 rounded-lg animate-pulse" />
        <div className="h-96 bg-slate-200 rounded-lg animate-pulse" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-slate-500">Accès non autorisé</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">
            Administration / Champs Personnalisés
          </p>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">
            Gestion des Champs Personnalisés
          </h1>
          <p className="text-sm text-slate-600 mt-2">
            Créez des champs personnalisés pour enrichir les profils utilisateurs. Ils seront disponibles dans les templates de documents.
          </p>
        </div>
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
              className="h-20 bg-slate-100 rounded-lg animate-pulse"
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
