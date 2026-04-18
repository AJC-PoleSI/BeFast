"use client"

import { useState, useEffect, useRef } from "react"
import { Search, MoreVertical, Loader, ExternalLink, ShieldCheck, ShieldAlert, CheckCircle2, Clock } from "lucide-react"
import Link from "next/link"
import { getAllMembers, updateMemberRole, getAllRoles } from "@/lib/actions/members"
import type { PersonneWithRole, ProfilType } from "@/types/database.types"
import { Badge } from "@/components/ui/badge"

const ROLE_MAP: Record<string, { label: string; color: string }> = {
  administrateur:  { label: "Administrateur",        color: "bg-red-50 text-red-700 border-red-200" },
  chef_projet_ajc: { label: "Chef.fe de projet AJC", color: "bg-blue-50 text-blue-700 border-blue-200" },
  membre_en_attente: { label: "En attente",          color: "bg-amber-50 text-amber-700 border-amber-200" },
  intervenant:     { label: "Intervenant",            color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
}

function RoleDropdown({ member, roles, onRoleChange, updating }: {
  member: PersonneWithRole
  roles: ProfilType[]
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
            {roles.map((r) => (
              <button
                key={r.slug}
                onClick={() => { setOpen(false); onRoleChange(member.id, r.slug) }}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-2 ${
                  member.profils_types?.slug === r.slug ? "font-semibold text-[#00236f]" : "text-slate-700"
                }`}
              >
                {member.profils_types?.slug === r.slug && (
                  <span className="material-symbols-outlined text-base text-[#00236f]">check</span>
                )}
                {r.nom}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminMembersPage() {
  const [members, setMembers] = useState<PersonneWithRole[]>([])
  const [allRoles, setAllRoles] = useState<ProfilType[]>([])
  const [filteredMembers, setFilteredMembers] = useState<PersonneWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("Tous")
  const [statusFilter, setStatusFilter] = useState("Tous")
  const [updating, setUpdating] = useState<string | null>(null)

  async function loadMembers() {
    const [membersResult, rolesResult] = await Promise.all([getAllMembers(), getAllRoles()])
    if (membersResult.error) { setError(membersResult.error); setLoading(false); return }
    setMembers(membersResult.data ?? [])
    setAllRoles(rolesResult.data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadMembers() }, [])

  useEffect(() => {
    let f = members
    if (roleFilter !== "Tous") f = f.filter(m => m.profils_types?.slug === roleFilter)
    if (statusFilter !== "Tous") f = f.filter(m => m.account_status === statusFilter)
    if (search) f = f.filter(m =>
      `${m.prenom} ${m.nom} ${m.email}`.toLowerCase().includes(search.toLowerCase())
    )
    setFilteredMembers(f)
  }, [members, roleFilter, statusFilter, search])

  async function handleRoleChange(personneId: string, newRole: string) {
    setUpdating(personneId)
    const result = await updateMemberRole(personneId, newRole)
    if (!result.success) alert(result.error)
    await loadMembers()
    setUpdating(null)
  }

  const pendingCount = members.filter(m => m.account_status !== "validated").length

  return (
    <div className="p-8 h-full flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Membres & Validation</h1>
          <p className="text-slate-500 text-sm mt-1">Gérez les comptes utilisateurs et validez les nouveaux membres.</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 text-sm font-semibold">
            <ShieldAlert className="w-4 h-4" />
            {pendingCount} compte{pendingCount > 1 ? "s" : ""} en attente de validation
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex-1 flex flex-col">
        
        {/* TOOLBAR */}
        <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row justify-between gap-4 bg-slate-50">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">Rôle</label>
              <div className="flex bg-white border border-slate-200 rounded-lg p-1 flex-wrap gap-1">
                {["Tous", ...allRoles.map(r => r.slug)].map((f) => (
                  <button
                    key={f}
                    onClick={() => setRoleFilter(f)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      roleFilter === f ? "bg-[#00236f] text-white" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {f === "Tous" ? "Tous" : (allRoles.find(r => r.slug === f)?.nom ?? f)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">Statut Compte</label>
              <div className="flex bg-white border border-slate-200 rounded-lg p-1 gap-1">
                {[
                  { value: "Tous", label: "Tous" },
                  { value: "pending_validation", label: "En attente" },
                  { value: "validated", label: "Validés" }
                ].map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStatusFilter(s.value)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      statusFilter === s.value ? "bg-[#00236f] text-white" : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:self-end">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Rechercher un membre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              />
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader className="w-8 h-8 animate-spin text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Chargement des membres...</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Membre</th>
                  <th className="px-6 py-4 font-semibold">Rôle</th>
                  <th className="px-6 py-4 font-semibold">Statut Compte</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      Aucun membre trouvé.
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
                            </div>
                            <div className="text-xs text-slate-500">{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {m.profils_types ? (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_MAP[m.profils_types.slug]?.color ?? "bg-purple-50 text-purple-700 border-purple-200"}`}>
                            {m.profils_types.nom}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Aucun rôle</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {m.account_status === "validated" ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Validé
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-600 font-medium text-xs">
                            <Clock className="w-3.5 h-3.5" />
                            En attente
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/dashboard/profil/${m.id}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all text-[#00236f] hover:bg-[#d0d8ff]"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Voir Profil
                          </Link>
                          {m.account_status !== "validated" && (
                            <button
                              onClick={async () => {
                                setUpdating(m.id)
                                const res = await fetch(`/api/admin/personnes/${m.id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ account_status: "validated" }),
                                })
                                if (res.ok) await loadMembers()
                                else alert("Erreur lors de la validation")
                                setUpdating(null)
                              }}
                              disabled={updating === m.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all bg-[#00236f] text-white hover:bg-[#1e3a8a] shadow-sm disabled:opacity-50"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Valider le compte
                            </button>
                          )}
                          <RoleDropdown
                            member={m}
                            roles={allRoles}
                            onRoleChange={handleRoleChange}
                            updating={updating}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
          {filteredMembers.length} membre{filteredMembers.length > 1 ? "s" : ""} affiché{filteredMembers.length > 1 ? "s" : ""}
        </div>
      </div>
    </div>
  )
}
