"use client"

import { useState, useEffect } from "react"
import { Loader, Plus, Trash2, Save, Check, AlertTriangle, X } from "lucide-react"
import { getAllRoles, updateRolePermissions, createRole, deleteRole } from "@/lib/actions/members"
import type { ProfilType } from "@/types/database.types"

type PermKey =
  | "dashboard" | "profil" | "missions" | "etudes"
  | "prospection" | "statistiques" | "administration"
  | "membres" | "documents" | "nouvelle_mission"

const PERM_LABELS: Record<PermKey, { label: string; description: string; icon: string }> = {
  dashboard:        { label: "Tableau de bord",  description: "Accès à la page d'accueil",              icon: "dashboard" },
  profil:           { label: "Mon Profil",        description: "Voir et modifier son propre profil",      icon: "person" },
  missions:         { label: "Missions",          description: "Consulter et candidater aux missions",    icon: "assignment" },
  etudes:           { label: "Études",            description: "Accès aux études en cours",               icon: "school" },
  documents:        { label: "Documents",         description: "Gérer ses propres documents",             icon: "folder_open" },
  prospection:      { label: "Prospection",       description: "Accès aux outils de prospection",        icon: "timeline" },
  statistiques:     { label: "Statistiques",      description: "Voir les statistiques financières",       icon: "bar_chart" },
  membres:          { label: "Gestion membres",   description: "Voir et gérer la liste des membres",     icon: "group" },
  administration:   { label: "Administration",    description: "Accès complet au panneau admin",          icon: "admin_panel_settings" },
  nouvelle_mission: { label: "Créer une mission", description: "Créer de nouvelles missions/études",     icon: "add_circle" },
}

const ALL_PERMS = Object.keys(PERM_LABELS) as PermKey[]

// ── Confirm Delete Modal ─────────────────────────────────────────────────────
function DeleteModal({ role, onConfirm, onCancel, loading }: {
  role: ProfilType
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 border border-red-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-manrope font-bold text-slate-900">Supprimer le rôle</h2>
            <p className="text-sm text-slate-500 mt-1">
              Êtes-vous certain de vouloir supprimer le rôle{" "}
              <span className="font-semibold text-slate-800">"{role.nom}"</span> ?
            </p>
            <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-xs text-red-700 font-medium">
                ⚠️ Cette action est irréversible. Les utilisateurs assignés à ce rôle perdront
                leurs droits d'accès et devront être réassignés manuellement.
              </p>
            </div>
          </div>
        </div>
        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            Supprimer définitivement
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Create Role Modal ────────────────────────────────────────────────────────
function CreateModal({ onConfirm, onCancel, loading }: {
  onConfirm: (nom: string, slug: string) => void
  onCancel: () => void
  loading: boolean
}) {
  const [nom, setNom] = useState("")
  const [slug, setSlug] = useState("")
  const [autoSlug, setAutoSlug] = useState(true)

  function handleNomChange(v: string) {
    setNom(v)
    if (autoSlug) {
      setSlug(v.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "").slice(0, 30))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-manrope font-bold text-slate-900">Créer un nouveau rôle</h2>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Nom du rôle
            </label>
            <input
              value={nom}
              onChange={(e) => handleNomChange(e.target.value)}
              placeholder="ex: Responsable Communication"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 focus:border-[#00236f]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
              Identifiant technique (slug)
            </label>
            <input
              value={slug}
              onChange={(e) => { setSlug(e.target.value); setAutoSlug(false) }}
              placeholder="ex: responsable_communication"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 focus:border-[#00236f] font-mono"
            />
            <p className="text-xs text-slate-400 mt-1">Minuscules, underscores uniquement. Unique et permanent.</p>
          </div>

          <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
            <p className="text-xs text-blue-700">
              💡 Le rôle sera créé sans aucune permission. Vous pourrez les configurer ensuite via l'éditeur de droits.
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
          >
            Annuler
          </button>
          <button
            onClick={() => onConfirm(nom, slug)}
            disabled={loading || !nom.trim() || !slug.trim()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-[#00236f] rounded-lg hover:bg-[#1e3a8a] disabled:opacity-50 transition-colors"
          >
            {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Créer le rôle
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ checked, onChange, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <button
      role="switch" aria-checked={checked} disabled={disabled}
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

// ── Main Page ────────────────────────────────────────────────────────────────
export default function DroitsPage() {
  const [roles, setRoles] = useState<ProfilType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<ProfilType | null>(null)
  const [permissions, setPermissions] = useState<Record<PermKey, boolean>>({} as any)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ProfilType | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)

  async function loadRoles() {
    try {
      const result = await getAllRoles()
      if (result.error) { setError(result.error); setLoading(false); return }
      if (!result.data) { setError("Aucun rôle disponible"); setLoading(false); return }
      setRoles(result.data)
      setLoading(false)
    } catch (err) {
      setError("Erreur lors du chargement")
      setLoading(false)
    }
  }

  useEffect(() => { loadRoles() }, [])

  function selectRole(role: ProfilType) {
    setSelectedRole(role)
    setSaved(false)
    const perms = {} as Record<PermKey, boolean>
    for (const key of ALL_PERMS) perms[key] = (role.permissions as any)?.[key] === true
    setPermissions(perms)
  }

  async function handleSave() {
    if (!selectedRole) return
    setSaving(true)
    const result = await updateRolePermissions(selectedRole.id, permissions)
    if (result.success) {
      setSaved(true)
      setRoles(prev => prev.map(r => r.id === selectedRole.id ? { ...r, permissions: permissions as any } : r))
    }
    setSaving(false)
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    const result = await deleteRole(deleteTarget.id)
    if (result.success) {
      const newRoles = roles.filter(r => r.id !== deleteTarget.id)
      setRoles(newRoles)
      if (selectedRole?.id === deleteTarget.id) {
        const next = newRoles.find(r => r.slug !== "administrateur") ?? newRoles[0] ?? null
        if (next) selectRole(next); else setSelectedRole(null)
      }
      setDeleteTarget(null)
    }
    setDeleting(false)
  }

  async function handleCreate(nom: string, slug: string) {
    setCreating(true)
    const result = await createRole(nom, slug)
    if (result.success && result.data) {
      const newRole = result.data
      setRoles(prev => [...prev, newRole].sort((a, b) => a.nom.localeCompare(b.nom)))
      selectRole(newRole)
      setShowCreate(false)
    } else {
      alert(result.error)
    }
    setCreating(false)
  }

  const isAdmin = selectedRole?.slug === "administrateur"

  return (
    <div className="p-8 h-full flex flex-col">
      {/* Modals */}
      {deleteTarget && (
        <DeleteModal
          role={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}
      {showCreate && (
        <CreateModal
          onConfirm={handleCreate}
          onCancel={() => setShowCreate(false)}
          loading={creating}
        />
      )}

      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Droits & Profils</h1>
          <p className="text-slate-500 text-sm mt-1">Gérez les rôles et leurs permissions d'accès.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#00236f] text-white text-sm font-semibold rounded-xl hover:bg-[#1e3a8a] transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Nouveau rôle
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader className="w-6 h-6 animate-spin text-slate-300" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
          <span className="material-symbols-outlined text-4xl">error_outline</span>
          <p className="text-sm font-semibold text-slate-600">{error}</p>
          <button onClick={() => { setError(null); setLoading(true); loadRoles() }}
            className="mt-2 px-4 py-2 text-sm bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300">
            Réessayer
          </button>
        </div>
      ) : (
        <div className="flex gap-6 flex-1 min-h-0">
          {/* Role list */}
          <div className="w-64 shrink-0">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {roles.length} rôle{roles.length > 1 ? "s" : ""}
                </p>
              </div>
              <div className="p-2">
                {roles.map(role => (
                  <div
                    key={role.id}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg group transition-colors cursor-pointer ${
                      selectedRole?.id === role.id
                        ? "bg-[#00236f] text-white"
                        : "text-slate-700 hover:bg-slate-100"
                    }`}
                    onClick={() => selectRole(role)}
                  >
                    <span className="text-sm font-medium truncate">{role.nom}</span>
                    {role.slug !== "administrateur" && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteTarget(role) }}
                        className={`shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                          selectedRole?.id === role.id
                            ? "hover:bg-white/20 text-white"
                            : "hover:bg-red-100 text-red-500"
                        }`}
                        title="Supprimer ce rôle"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Permissions editor */}
          {selectedRole ? (
            <div className="flex-1 overflow-y-auto">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                  <div>
                    <h2 className="font-manrope font-bold text-[#00236f] text-lg">{selectedRole.nom}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isAdmin
                        ? "Rôle système — toutes les permissions sont actives et non modifiables."
                        : "Activez ou désactivez les accès puis enregistrez."}
                    </p>
                  </div>
                  {!isAdmin && (
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${
                        saved
                          ? "bg-green-100 text-green-700"
                          : "bg-[#00236f] text-white hover:bg-[#1e3a8a]"
                      }`}
                    >
                      {saving ? <Loader className="w-4 h-4 animate-spin" />
                        : saved ? <Check className="w-4 h-4" />
                        : <Save className="w-4 h-4" />}
                      {saved ? "Sauvegardé !" : "Enregistrer"}
                    </button>
                  )}
                </div>

                <div className="divide-y divide-slate-100">
                  {ALL_PERMS.map(key => {
                    const info = PERM_LABELS[key]
                    const active = isAdmin ? true : permissions[key]
                    return (
                      <div key={key} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                            active ? "bg-[#d0d8ff]" : "bg-slate-100"
                          }`}>
                            <span className={`material-symbols-outlined text-xl transition-colors ${
                              active ? "text-[#00236f]" : "text-slate-400"
                            }`}>{info.icon}</span>
                          </div>
                          <div>
                            <p className={`text-sm font-semibold transition-colors ${
                              active ? "text-slate-800" : "text-slate-400"
                            }`}>{info.label}</p>
                            <p className="text-xs text-slate-400">{info.description}</p>
                          </div>
                        </div>
                        <Toggle
                          checked={active}
                          onChange={(v) => { setSaved(false); setPermissions(p => ({ ...p, [key]: v })) }}
                          disabled={isAdmin}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-400">
              <p className="text-sm">Sélectionnez un rôle pour gérer ses permissions</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
