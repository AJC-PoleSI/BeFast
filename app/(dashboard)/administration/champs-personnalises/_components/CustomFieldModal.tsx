"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import { z } from "zod"
import { customFieldSchema } from "@/app/(dashboard)/dashboard/profil/_lib/schemas"

interface CustomField {
  id?: string
  name: string
  slug: string
  type: "text" | "select" | "date" | "number"
  required: boolean
  options?: string[]
  description?: string
  ordre?: number
}

interface CustomFieldModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  field?: CustomField
  onSuccess: () => void
}

export function CustomFieldModal({
  open,
  onOpenChange,
  field,
  onSuccess,
}: CustomFieldModalProps) {
  const [formData, setFormData] = useState<CustomField>({
    name: "",
    slug: "",
    type: "text",
    required: false,
    options: [],
    description: "",
    ordre: 0,
  })
  const [saving, setSaving] = useState(false)
  const [optionsInput, setOptionsInput] = useState("")

  useEffect(() => {
    if (field) {
      setFormData(field)
      setOptionsInput(field.options?.join(", ") || "")
    } else {
      setFormData({
        name: "",
        slug: "",
        type: "text",
        required: false,
        options: [],
        description: "",
        ordre: 0,
      })
      setOptionsInput("")
    }
  }, [field, open])

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .replace(/\s+/g, "_")
      .substring(0, 50)
  }

  const handleNameChange = (val: string) => {
    setFormData((prev) => ({
      ...prev,
      name: val,
      slug: generateSlug(val),
    }))
  }

  const handleSave = async () => {
    try {
      const dataToValidate = {
        ...formData,
        options:
          formData.type === "select"
            ? optionsInput
                .split(",")
                .map((o) => o.trim())
                .filter(Boolean)
            : undefined,
      }

      const parsed = customFieldSchema.safeParse(dataToValidate)

      if (!parsed.success) {
        toast.error("Données invalides: " + parsed.error.errors[0].message)
        return
      }

      if (formData.type === "select" && (!parsed.data.options || parsed.data.options.length === 0)) {
        toast.error("Veuillez ajouter au moins une option pour un champ select")
        return
      }

      setSaving(true)

      const method = field?.id ? "PATCH" : "POST"
      const body = field?.id ? { id: field.id, ...parsed.data } : parsed.data

      const res = await fetch("/api/admin/custom-fields", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Erreur lors de la sauvegarde")
        return
      }

      toast.success(
        field?.id
          ? "Champ mis à jour avec succès"
          : "Champ créé avec succès"
      )
      onOpenChange(false)
      onSuccess()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg max-w-md w-full mx-4 p-6">
        <h2 className="font-manrope font-bold text-[#00236f] text-lg mb-4">
          {field?.id ? "Modifier le champ" : "Créer un champ"}
        </h2>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Nom du champ
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              placeholder="Ex: Numéro d'étudiant"
            />
          </div>

          {/* Slug */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Slug (auto-généré)
            </label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
              className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              placeholder="numero_etudiant"
            />
            <p className="text-xs text-slate-400 mt-1">
              Utilisé dans les templates: {"{{"}{{ formData.slug }}{"}"}
            </p>
          </div>

          {/* Type */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Type
            </label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  type: e.target.value as any,
                  options: [],
                }))
              }
              className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
            >
              <option value="text">Texte</option>
              <option value="select">Sélection</option>
              <option value="date">Date</option>
              <option value="number">Nombre</option>
            </select>
          </div>

          {/* Options (if type = select) */}
          {formData.type === "select" && (
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                Options (séparées par des virgules)
              </label>
              <textarea
                value={optionsInput}
                onChange={(e) => setOptionsInput(e.target.value)}
                className="w-full h-24 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                placeholder="Option 1, Option 2, Option 3"
              />
            </div>
          )}

          {/* Required */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="required"
              checked={formData.required}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, required: e.target.checked }))
              }
              className="w-4 h-4"
            />
            <label htmlFor="required" className="text-sm text-slate-700">
              Champ obligatoire
            </label>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Description (optionnel)
            </label>
            <textarea
              value={formData.description || ""}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              className="w-full h-20 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              placeholder="Description affichée aux utilisateurs"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2 mt-6">
          <button
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 px-4 py-2 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors disabled:opacity-50"
          >
            {saving ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  )
}
