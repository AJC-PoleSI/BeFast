"use client"

import { useState, useEffect, useRef } from "react"
import { Search, MoreVertical, Loader } from "lucide-react"
import { getAllMembers, updateMemberRole } from "@/lib/actions/members"
import type { PersonneWithRole } from "@/types/database.types"

const ROLE_MAP: Record<string, { label: string; color: string }> = {
  administrateur:    { label: "Administrateur",         color: "bg-red-50 text-red-700 border-red-200" },
  chef_projet_ajc:   { label: "Chef.fe de projet AJC",  color: "bg-blue-50 text-blue-700 border-blue-200" },
  ancien_membre_agc: { label: "Ancien Membre",           color: "bg-slate-100 text-slate-600 border-slate-200" },
  intervenant:       { label: "Intervenant",             color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  chef_de_projet:    { label: "Chef de Projet",          color: "bg-amber-50 text-amber-700 border-amber-200" },
}

function RoleDropdown({ member, onRoleChange, updating }: {
  member: PersonneWithRole
  onRoleChange: (id: string, role: string) => void
  updating: string | null
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        disabled={updating === member.id}
        className="p-1.5 text-slate-400 hover:text-[#00236f] hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
      >
        {updating === member.id
          ? <Loader className="w-5 h-5 animate-spin" />
          : <MoreVertical className="w-5 h-5" />}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-52 bg-white border border-slate-200 rounded-xl shadow-xl z-20">
          <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Changer le rôle
          </p>
          <div className="p-1.5">
            {Object.entries(ROLE_MAP).map(([roleSlug, roleData]) => (
              <button
                key={roleSlug}
                onClick={() => { setOpen(false); onRoleChange(member.id, roleSlug) }}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-2 ${
                  member.profils_types?.slug === roleSlug ? "font-semibold text-[#00236f]" : "text-slate-700"
                }`}
              >
                {member.profils_types?.slug === roleSlug && (
                  <span className="material-symbols-outlined text-base text-[#00236f]">check</span>
                )}
                {roleData.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function MemberManagementPage() {
  const [members, setMembers] = useState<PersonneWithRole[]>([])
  const [filteredMembers, setFilteredMembers] = useState<PersonneWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("Tous")
  const [updating, setUpdating] = useState<string | null>(null)

  async function loadMembers() {
    const result = await getAllMembers()
    if (result.error) { setError(result.error); setLoading(false); return }
    setMembers(result.data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadMembers() }, [])

  useEffect(() => {
    let f = members
    if (filter !== "Tous") f = f.filter(m => m.profils_types?.slug === filter)
    if (search) f = f.filter(m =>
      `${m.prenom} ${m.nom} ${m.email}`.toLowerCase().includes(search.toLowerCase())
    )
    setFilteredMembers(f)
  }, [members, filter, search])

  async function handleRoleChange(personneId: string, newRole: string) {
    setUpdating(personneId)
    const result = await updateMemberRole(personneId, newRole)
    if (!result.success) alert(result.error)
    await loadMembers()
    setUpdating(null)
  }

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-manrope font-black text-[#00236f]">Gestion des Membres</h1>
        <p className="text-slate-500 text-sm mt-1">Voir et modifier les rôles des utilisateurs inscrits.</p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex-1 flex flex-col">

        {/* TOOLBAR */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-3 bg-slate-50">
          <div className="flex bg-white border border-slate-200 rounded-lg p-1 flex-wrap gap-1">
            {["Tous", ...Object.keys(ROLE_MAP)].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  filter === f ? "bg-[#00236f] text-white" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {f === "Tous" ? "Tous" : ROLE_MAP[f]?.label}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg w-full sm:w-60 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
            />
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader className="w-6 h-6 animate-spin text-slate-300" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-2">
              <span className="material-symbols-outlined text-4xl">lock</span>
              <p className="text-sm">{error}</p>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Utilisateur</th>
                  <th className="px-6 py-4 font-semibold">Rôle actuel</th>
                  <th className="px-6 py-4 font-semibold">Inscrit le</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      Aucun utilisateur trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#00236f]/10 text-[#00236f] flex items-center justify-center font-bold text-sm shrink-0">
                            {(m.prenom?.[0] ?? "?").toUpperCase()}{(m.nom?.[0] ?? "").toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">
                              {m.prenom || ""} {m.nom || ""}
                              {!m.prenom && !m.nom && <span className="text-slate-400 italic">Sans nom</span>}
                            </div>
                            <div className="text-xs text-slate-500">{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {m.profils_types ? (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_MAP[m.profils_types.slug]?.color ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>
                            {ROLE_MAP[m.profils_types.slug]?.label ?? m.profils_types.nom}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Aucun rôle</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-500 text-xs">
                        {new Date(m.created_at).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <RoleDropdown
                          member={m}
                          onRoleChange={handleRoleChange}
                          updating={updating}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
          {filteredMembers.length} utilisateur{filteredMembers.length > 1 ? "s" : ""}
          {members.length !== filteredMembers.length && ` sur ${members.length}`}
        </div>
      </div>
    </div>
  )
}
