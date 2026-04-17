"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"

interface CustomField {
  id: string
  name: string
  slug: string
  type: "text" | "select" | "date" | "number"
  required: boolean
  options?: { values: string[] }
  description?: string
  value: string
}

interface DynamicFieldsCardProps {
  isOwnProfile?: boolean
}

export function DynamicFieldsCard({ isOwnProfile = true }: DynamicFieldsCardProps) {
  const [fields, setFields] = useState<CustomField[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState<Record<string, string>>({})

  const fetchFields = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/profil/custom-fields")
      const data = await res.json()
      if (res.ok) {
        setFields(data.fields || [])
        const initialValues: Record<string, string> = {};
        (data.fields || []).forEach((field: CustomField) => {
          initialValues[field.id] = field.value || ""
        })
        setValues(initialValues)
      }
    } catch {
      toast.error("Erreur lors du chargement des champs")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFields()
  }, [fetchFields])

  const handleChange = (fieldId: string, val: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: val }))
  }

  const handleCancel = () => {
    const initialValues: Record<string, string> = {}
    fields.forEach((field) => {
      initialValues[field.id] = field.value || ""
    })
    setValues(initialValues)
    setEditing(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updates = fields.map((field) => ({
        fieldId: field.id,
        value: values[field.id] || "",
      }))

      const res = await fetch("/api/profil/custom-fields", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Erreur lors de la mise à jour")
        return
      }

      toast.success("Champs personnalisés mis à jour avec succès.")
      await fetchFields()
      setEditing(false)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-manrope font-bold text-[#00236f] text-base">Champs Personnalisés</h2>
        </div>
        <div className="p-6 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!fields || fields.length === 0) {
    return null
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h2 className="font-manrope font-bold text-[#00236f] text-base">Champs Personnalisés</h2>
        {isOwnProfile && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#00236f] hover:bg-[#d0d8ff] transition-colors"
          >
            <span className="material-symbols-outlined text-base">edit</span>
            Modifier
          </button>
        )}
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {fields.map((field) => (
            <div key={field.id}>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                {field.name}
                {field.required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {field.description && (
                <p className="text-xs text-slate-400 mb-1">{field.description}</p>
              )}

              {editing ? (
                <>
                  {field.type === "select" ? (
                    <select
                      value={values[field.id] || ""}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                    >
                      <option value="">-- Sélectionnez --</option>
                      {field.options?.values?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "date" ? (
                    <input
                      type="date"
                      value={values[field.id] || ""}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                    />
                  ) : field.type === "number" ? (
                    <input
                      type="number"
                      value={values[field.id] || ""}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                    />
                  ) : (
                    <input
                      type="text"
                      value={values[field.id] || ""}
                      onChange={(e) => handleChange(field.id, e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                    />
                  )}
                </>
              ) : (
                <p className="text-sm px-3 py-2 rounded-lg bg-slate-50 min-h-[36px] flex items-center text-slate-700">
                  {values[field.id] ? (
                    field.type === "date" && values[field.id]
                      ? new Date(values[field.id]).toLocaleDateString("fr-FR")
                      : values[field.id]
                  ) : (
                    <span className="text-slate-300 italic text-xs">Non renseigné</span>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>

        {editing && (
          <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-slate-100">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors disabled:opacity-50"
            >
              {saving ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">autorenew</span>
                  Enregistrement...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">save</span>
                  Enregistrer
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
