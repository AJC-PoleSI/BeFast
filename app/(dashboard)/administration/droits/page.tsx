"use client"

import { useState, useEffect } from "react"
import { Loader } from "lucide-react"
import { getAllRoles, updateRolePermissions } from "@/lib/actions/members"
import type { ProfilType } from "@/types/database.types"

type PermKey =
  | "dashboard" | "profil" | "missions" | "etudes"
  | "prospection" | "statistiques" | "administration"
  | "membres" | "documents" | "nouvelle_mission"

const PERM_LABELS: Record<PermKey, { label: string; description: string; icon: string }> = {
  dashboard:       { label: "Tableau de bord",        description: "Accès à la page d'accueil",                icon: "dashboard" },
  profil:          { label: "Mon Profil",              description: "Voir et modifier son propre profil",        icon: "person" },
  missions:        { label: "Missions",                description: "Consulter et candidater aux missions",      icon: "assignment" },
  etudes:          { label: "Études",                  description: "Accès aux études en cours",                 icon: "school" },
  documents:       { label: "Documents",               description: "Gérer ses propres documents",              icon: "folder_open" },
  prospection:     { label: "Prospection",             description: "Accès aux outils de prospection",          icon: "timeline" },
  statistiques:    { label: "Statistiques",            description: "Voir les statistiques financières",         icon: "bar_chart" },
  membres:         { label: "Gestion membres",         description: "Voir la liste des membres",                icon: "group" },
  administration:  { label: "Administration",          description: "Accès complet au panneau admin",            icon: "admin_panel_settings" },
  nouvelle_mission:{ label: "Créer une mission",       description: "Créer de nouvelles missions/études",       icon: "add_circle" },
}

const ALL_PERMS = Object.keys(PERM_LABELS) as PermKey[]

function ToggleSwitch({ checked, onChange, disabled }: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
        checked ? "bg-[#00236f]" : "bg-slate-200"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
        checked ? "translate-x-6" : "translate-x-1"
      }`} />
    </button>
  )
}

export default function DroitsPage() {
  const [roles, setRoles] = useState<ProfilType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<ProfilType | null>(null)
  const [permissions, setPermissions] = useState<Record<PermKey, boolean>>({} as any)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        console.log("[DroitsPage] Loading roles...")
        const result = await getAllRoles()

        if (result.error) {
          console.error("[DroitsPage] Error:", result.error)
          setError(result.error)
          setLoading(false)
          return
        }

        if (!result.data) {
          console.warn("[DroitsPage] No roles returned")
          setError("Aucun rôle disponible")
          setLoading(false)
          return
        }

        console.log(`[DroitsPage] Loaded ${result.data.length} roles`)
        setRoles(result.data as ProfilType[])
        // Auto-select first non-admin role
        const first = (result.data as ProfilType[]).find(r => r.slug !== "administrateur") ?? result.data[0]
        if (first) selectRole(first as ProfilType)
        setLoading(false)
      } catch (err) {
        console.error("[DroitsPage] Exception:", err)
        setError("Erreur lors du chargement des rôles")
        setLoading(false)
      }
    }
    load()
  }, [])

  function selectRole(role: ProfilType) {
    setSelectedRole(role)
    setSaved(false)
    const perms: Record<PermKey, boolean> = {} as any
    for (const key of ALL_PERMS) {
      perms[key] = (role.permissions as any)?.[key] === true
    }
    setPermissions(perms)
  }

  function togglePerm(key: PermKey, value: boolean) {
    setSaved(false)
    setPermissions(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!selectedRole) return
    setSaving(true)
    const result = await updateRolePermissions(selectedRole.id, permissions)
    if (result.success) {
      setSaved(true)
      // Update local role list
      setRoles(prev => prev.map(r =>
        r.id === selectedRole.id ? { ...r, permissions: permissions as any } : r
      ))
    }
    setSaving(false)
  }

  const isAdminRole = selectedRole?.slug === "administrateur"

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-manrope font-black text-[#00236f]">Droits & Profils</h1>
        <p className="text-slate-500 text-sm mt-1">
          Configurez précisément les accès pour chaque rôle utilisateur.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader className="w-6 h-6 animate-spin text-slate-300" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
          <span className="material-symbols-outlined text-4xl">error_outline</span>
          <p className="text-sm font-semibold text-slate-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300"
          >
            Réessayer
          </button>
        </div>
      ) : (
        <div className="flex gap-6 flex-1 min-h-0">
          {/* Role list */}
          <div className="w-60 shrink-0">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Rôles</p>
              </div>
              <div className="p-2">
                {roles.map(role => (
                  <button
                    key={role.id}
                    onClick={() => selectRole(role)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      selectedRole?.id === role.id
                        ? "bg-[#00236f] text-white font-semibold"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    {role.nom}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Permissions editor */}
          {selectedRole && (
            <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-y-auto">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-manrope font-bold text-[#00236f]">{selectedRole.nom}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isAdminRole ? "Rôle administrateur — toutes les permissions sont actives." : "Configurez les accès de ce rôle"}
                    </p>
                  </div>
                  {!isAdminRole && (
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors disabled:opacity-50"
                    >
                      {saving
                        ? <Loader className="w-4 h-4 animate-spin" />
                        : saved
                          ? <span className="material-symbols-outlined text-base">check</span>
                          : <span className="material-symbols-outlined text-base">save</span>
                      }
                      {saved ? "Sauvegardé" : "Enregistrer"}
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100">
                  {ALL_PERMS.map(key => {
                    const info = PERM_LABELS[key]
                    const active = isAdminRole ? true : permissions[key]
                    return (
                      <div key={key} className="flex items-center justify-between px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            active ? "bg-[#d0d8ff]" : "bg-slate-100"
                          }`}>
                            <span className={`material-symbols-outlined text-xl ${
                              active ? "text-[#00236f]" : "text-slate-400"
                            }`}>{info.icon}</span>
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${active ? "text-slate-800" : "text-slate-400"}`}>
                              {info.label}
                            </p>
                            <p className="text-xs text-slate-400">{info.description}</p>
                          </div>
                        </div>
                        <ToggleSwitch
                          checked={active}
                          onChange={(v) => togglePerm(key, v)}
                          disabled={isAdminRole}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
