"use client"

import { useState } from "react"
import { toast } from "sonner"
import type { PersonneWithRole } from "@/types/database.types"
import type { ProfileFormValues } from "@/app/(dashboard)/dashboard/profil/_lib/schemas"

const POLES = [
  "Developpement",
  "Commercial",
  "Communication",
  "Tresorerie",
  "Presidence",
  "Secretariat",
  "Qualite",
  "RH",
]

const FIELD_CONFIG = [
  { name: "prenom" as const, label: "Prénom", required: true },
  { name: "nom" as const, label: "Nom", required: true },
  { name: "portable" as const, label: "Portable", required: false },
  { name: "promo" as const, label: "Promotion / École", required: false },
  { name: "adresse" as const, label: "Adresse Complète", required: false },
  { name: "ville" as const, label: "Ville", required: false },
  { name: "code_postal" as const, label: "Code Postal", required: false },
]

interface ProfileInfoCardProps {
  profile: PersonneWithRole
  onUpdate: (profile: PersonneWithRole) => void
  readOnly?: boolean
}

export function ProfileInfoCard({ profile, onUpdate, readOnly }: ProfileInfoCardProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState<ProfileFormValues>({
    prenom: profile.prenom || "",
    nom: profile.nom || "",
    portable: profile.portable || "",
    promo: profile.promo || "",
    adresse: profile.adresse || "",
    ville: profile.ville || "",
    code_postal: profile.code_postal || "",
    pole: profile.pole || "",
  })

  const handleChange = (field: keyof ProfileFormValues, val: string) => {
    setValues((prev) => ({ ...prev, [field]: val }))
  }

  const handleCancel = () => {
    setValues({
      prenom: profile.prenom || "",
      nom: profile.nom || "",
      portable: profile.portable || "",
      promo: profile.promo || "",
      adresse: profile.adresse || "",
      ville: profile.ville || "",
      code_postal: profile.code_postal || "",
      pole: profile.pole || "",
    })
    setEditing(false)
  }

  const handleSave = async () => {
    if (!values.prenom?.trim() || !values.nom?.trim()) {
      toast.error("Le prénom et le nom sont requis")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/profil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Erreur lors de la mise à jour")
        return
      }
      toast.success("Profil mis à jour avec succès.")
      onUpdate({ ...profile, ...values })
      setEditing(false)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
        <h2 className="font-manrope font-bold text-[#00236f] text-base">Informations Personnelles</h2>
        {!readOnly && !editing && (
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
        {/* Email always shown */}
        <div className="mb-4 p-3 bg-slate-50 rounded-xl">
          <p className="text-xs text-slate-400 mb-0.5">Email Académique</p>
          <p className="text-sm font-medium text-slate-800">{profile.email}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {FIELD_CONFIG.map(({ name, label, required }) => (
            <div key={name}>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {editing ? (
                <input
                  type="text"
                  value={values[name] || ""}
                  onChange={(e) => handleChange(name, e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                />
              ) : (
                <p className="text-sm px-3 py-2 rounded-lg bg-slate-50 min-h-[36px] flex items-center text-slate-700">
                  {values[name] || <span className="text-slate-300 italic text-xs">Non renseigné</span>}
                </p>
              )}
            </div>
          ))}

          {/* Pole */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Pôle</label>
            {editing ? (
              <select
                value={values.pole || ""}
                onChange={(e) => handleChange("pole", e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              >
                <option value="">-- Aucun --</option>
                {POLES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <p className="text-sm px-3 py-2 rounded-lg bg-slate-50 min-h-[36px] flex items-center text-slate-700">
                {values.pole || <span className="text-slate-300 italic text-xs">Non renseigné</span>}
              </p>
            )}
          </div>
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
