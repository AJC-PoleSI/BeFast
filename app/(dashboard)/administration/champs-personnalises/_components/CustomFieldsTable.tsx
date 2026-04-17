"use client"

import { useState } from "react"
import { toast } from "sonner"

interface CustomField {
  id: string
  name: string
  slug: string
  type: string
  required: boolean
  description?: string
  ordre: number
}

interface CustomFieldsTableProps {
  fields: CustomField[]
  onEdit: (field: CustomField) => void
  onRefresh: () => void
}

const TYPE_LABELS: Record<string, string> = {
  text: "Texte",
  select: "Sélection",
  date: "Date",
  number: "Nombre",
}

export function CustomFieldsTable({
  fields,
  onEdit,
  onRefresh,
}: CustomFieldsTableProps) {
  const [deleting, setDeleting] = useState<string | null>(null)

  const handleDelete = async (id: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce champ?")) return

    setDeleting(id)
    try {
      const res = await fetch(`/api/admin/custom-fields?id=${id}`, {
        method: "DELETE",
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || "Erreur lors de la suppression")
        return
      }

      toast.success("Champ supprimé avec succès")
      onRefresh()
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setDeleting(null)
    }
  }

  if (fields.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
        <p className="text-slate-500">Aucun champ personnalisé créé</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">
                Nom
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">
                Slug
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">
                Requis
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr
                key={field.id}
                className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <td className="px-6 py-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {field.name}
                    </p>
                    {field.description && (
                      <p className="text-xs text-slate-500 mt-1">
                        {field.description}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <code className="text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded">
                    {field.slug}
                  </code>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-block px-2.5 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-medium">
                    {TYPE_LABELS[field.type] || field.type}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`text-xs font-medium ${
                      field.required
                        ? "text-red-600"
                        : "text-slate-500"
                    }`}
                  >
                    {field.required ? "Oui" : "Non"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onEdit(field)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#00236f] hover:bg-[#d0d8ff] transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                      Modifier
                    </button>
                    <button
                      onClick={() => handleDelete(field.id)}
                      disabled={deleting === field.id}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      {deleting === field.id ? "..." : "Supprimer"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
