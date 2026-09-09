"use client"

import { useState, useEffect } from "react"
import { toast } from "sonner"
import type { PersonneWithRole } from "@/types/database.types"
import type { ProfileFormValues } from "@/app/(dashboard)/dashboard/profil/_lib/schemas"
import { ETABLISSEMENTS, SCOLARITES } from "@/app/(dashboard)/dashboard/profil/_lib/schemas"
import { getParametre } from "@/lib/actions/etudes"

const DEFAULT_POLES = [
  "Developpement",
  "Commercial",
  "Communication",
  "Tresorerie",
  "Presidence",
  "Secretariat",
  "Qualite",
  "RH",
  "SI",
]

function parsePoles(raw: string | null | undefined): string[] {
  if (!raw) return DEFAULT_POLES
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr) && arr.every(v => typeof v === "string")) return arr
  } catch {
    return raw.split(",").map(s => s.trim()).filter(Boolean)
  }
  return DEFAULT_POLES
}

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
  isAdmin?: boolean
}

export function ProfileInfoCard({ profile, onUpdate, readOnly, isAdmin }: ProfileInfoCardProps) {
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [poles, setPoles] = useState<string[]>(DEFAULT_POLES)
  const [loadingDecrypted, setLoadingDecrypted] = useState(true)

  useEffect(() => {
    getParametre("poles_liste").then((raw) => setPoles(parsePoles(raw as string | null)))
  }, [])

  const buildValues = (p: PersonneWithRole): ProfileFormValues => ({
    prenom: p.prenom || "",
    nom: p.nom || "",
    portable: p.portable || "",
    promo: p.promo || "",
    adresse: p.adresse || "",
    ville: p.ville || "",
    code_postal: p.code_postal || "",
    pole: p.pole || "",
    etablissement: (p.etablissement as any) || "",
    scolarite: (p.scolarite as any) || "",
    date_naissance: (p.date_naissance as any) || "",
  })

  const [values, setValues] = useState<ProfileFormValues>(buildValues(profile))

  // Charger le profil décrypté depuis l'API (le profil du layout/cache
  // ne contient pas les champs chiffrés décryptés comme date_naissance)
  useEffect(() => {
    let cancelled = false
    fetch("/api/profil")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled || !json.data) return
        const decrypted = json.data as PersonneWithRole
        setValues(buildValues(decrypted))
        setLoadingDecrypted(false)
      })
      .catch(() => setLoadingDecrypted(false))
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Synchroniser les champs NON chiffrés si le profil parent change.
  // On ne touche PAS aux champs chiffrés (date_naissance, adresse, ville,
  // code_postal) car le profil parent vient du cache serveur non décrypté.
  useEffect(() => {
    setValues((prev) => ({
      ...prev,
      prenom: profile.prenom || "",
      nom: profile.nom || "",
      portable: profile.portable || "",
      promo: profile.promo || "",
      pole: profile.pole || "",
      etablissement: (profile.etablissement as any) || prev.etablissement || "",
      scolarite: (profile.scolarite as any) || prev.scolarite || "",
    }))
  }, [profile])

  const handleChange = (field: keyof ProfileFormValues, val: string) => {
    setValues((prev) => ({ ...prev, [field]: val }))
  }

  // Snapshot des dernières valeurs sauvegardées (issues de l'API décryptée)
  const [savedValues, setSavedValues] = useState<ProfileFormValues>(buildValues(profile))

  // Mettre à jour le snapshot quand on charge le profil décrypté
  useEffect(() => {
    if (!loadingDecrypted) {
      setSavedValues({ ...values })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingDecrypted])

  const handleCancel = () => {
    setValues({ ...savedValues })
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
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error || "Erreur lors de la mise à jour")
        return
      }
      toast.success("Profil mis à jour avec succès.")

      // Utiliser la réponse décryptée de l'API pour mettre à jour
      const updatedProfile = json.data as PersonneWithRole
      const newValues = buildValues(updatedProfile)
      setValues(newValues)
      setSavedValues(newValues)

      onUpdate({
        ...profile,
        ...updatedProfile,
        etablissement: (updatedProfile.etablissement || null) as any,
        scolarite: (updatedProfile.scolarite || null) as any,
        date_naissance: updatedProfile.date_naissance || null,
      })
      setEditing(false)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
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
        <div className="mb-4 p-3 bg-zinc-50 rounded-xl">
          <p className="text-xs text-zinc-400 mb-0.5">Email Académique</p>
          <p className="text-sm font-medium text-zinc-800">{profile.email}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {FIELD_CONFIG.map(({ name, label, required }) => (
            <div key={name}>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">
                {label}{required && <span className="text-red-500 ml-0.5">*</span>}
              </label>
              {editing ? (
                <input
                  type="text"
                  value={values[name] || ""}
                  onChange={(e) => handleChange(name, e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                />
              ) : (
                <p className="text-sm px-3 py-2 rounded-lg bg-zinc-50 min-h-[36px] flex items-center text-zinc-700">
                  {values[name] || <span className="text-zinc-300 italic text-xs">Non renseigné</span>}
                </p>
              )}
            </div>
          ))}

          {/* Pole */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5 flex items-center justify-between">
              Pôle
              {!isAdmin && <span className="text-[10px] text-zinc-400 font-normal italic">Réservé Administration</span>}
            </label>
            {editing && isAdmin ? (
              <select
                value={values.pole || ""}
                onChange={(e) => handleChange("pole", e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              >
                <option value="">-- Aucun --</option>
                {poles.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            ) : (
              <p className="text-sm px-3 py-2 rounded-lg bg-zinc-50 min-h-[36px] flex items-center text-zinc-700">
                {values.pole || <span className="text-zinc-300 italic text-xs">Non renseigné</span>}
              </p>
            )}
          </div>

          {/* Établissement */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Établissement</label>
            {editing ? (
              <select
                value={values.etablissement || ""}
                onChange={(e) => handleChange("etablissement", e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              >
                <option value="">-- Aucun --</option>
                {ETABLISSEMENTS.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            ) : (
              <p className="text-sm px-3 py-2 rounded-lg bg-zinc-50 min-h-[36px] flex items-center text-zinc-700">
                {values.etablissement || <span className="text-zinc-300 italic text-xs">Non renseigné</span>}
              </p>
            )}
          </div>

          {/* Scolarité */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Scolarité</label>
            {editing ? (
              <select
                value={values.scolarite || ""}
                onChange={(e) => handleChange("scolarite", e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              >
                <option value="">-- Aucun --</option>
                {SCOLARITES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            ) : (
              <p className="text-sm px-3 py-2 rounded-lg bg-zinc-50 min-h-[36px] flex items-center text-zinc-700">
                {values.scolarite || <span className="text-zinc-300 italic text-xs">Non renseigné</span>}
              </p>
            )}
          </div>

          {/* Date de Naissance */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 mb-1.5">Date de Naissance</label>
            {editing ? (
              <input
                type="date"
                value={values.date_naissance || ""}
                onChange={(e) => handleChange("date_naissance", e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-zinc-200 bg-zinc-50 text-sm text-zinc-800 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              />
            ) : (
              <p className="text-sm px-3 py-2 rounded-lg bg-zinc-50 min-h-[36px] flex items-center text-zinc-700">
                {values.date_naissance ? new Date(values.date_naissance).toLocaleDateString('fr-FR') : <span className="text-zinc-300 italic text-xs">Non renseigné</span>}
              </p>
            )}
          </div>
        </div>

        {editing && (
          <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-zinc-100">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-4 py-2 rounded-xl border border-zinc-200 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors disabled:opacity-50"
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
