"use client"

import { useState, useEffect } from "react"
import { Search, MoreVertical, ShieldAlert, UserCheck, Shield, Loader } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { updateMemberRole } from "@/lib/actions/members"
import type { PersonneWithRole } from "@/types/database.types"

const ROLE_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  administrateur: { label: "Administrateur", color: "bg-red-50 text-red-700 border-red-200", icon: "⚙️" },
  membre_agc: { label: "Membre AGC", color: "bg-blue-50 text-blue-700 border-blue-200", icon: "👥" },
  ancien_membre_agc: { label: "Ancien Membre", color: "bg-slate-100 text-slate-600 border-slate-200", icon: "📦" },
  intervenant: { label: "Intervenant", color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: "💼" },
  chef_de_projet: { label: "Chef de Projet", color: "bg-amber-50 text-amber-700 border-amber-200", icon: "📊" },
}

export default function MemberManagementPage() {
  const [members, setMembers] = useState<PersonneWithRole[]>([])
  const [filteredMembers, setFilteredMembers] = useState<PersonneWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<string>("Tous")
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    async function loadMembers() {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("personnes")
        .select("*, profils_types(*)")
        .order("created_at", { ascending: false })

      if (!error && data) {
        setMembers(data as PersonneWithRole[])
      }
      setLoading(false)
    }
    loadMembers()
  }, [])

  useEffect(() => {
    let filtered = members
    if (filter !== "Tous") {
      filtered = filtered.filter(m => m.profils_types?.slug === filter)
    }
    if (search) {
      filtered = filtered.filter(m =>
        `${m.prenom} ${m.nom} ${m.email}`.toLowerCase().includes(search.toLowerCase())
      )
    }
    setFilteredMembers(filtered)
  }, [members, filter, search])

  async function handleRoleChange(personneId: string, newRole: string) {
    setUpdating(personneId)
    const result = await updateMemberRole(personneId, newRole)
    if (result.success) {
      setMembers(members.map(m =>
        m.id === personneId ? { ...m, profils_types: result.profil } : m
      ))
    }
    setUpdating(null)
  }

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Gestion des Membres</h1>
          <p className="text-slate-500 text-sm mt-1">Supervisez l'ensemble des profils et droits d'accès de votre équipe.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex-1 flex flex-col">

        {/* TOOLBAR */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4 bg-slate-50">
          <div className="flex bg-white border border-slate-200 rounded-lg p-1 flex-wrap gap-1">
            {["Tous", "administrateur", "membre_agc", "ancien_membre_agc", "intervenant", "chef_de_projet"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  filter === f ? "bg-slate-100 text-slate-800" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {f === "Tous" ? "Tous" : ROLE_MAP[f]?.label || f}
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
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all font-medium"
            />
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="overflow-x-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-6 py-4 font-semibold">Membre</th>
                  <th className="px-6 py-4 font-semibold">Rôle</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-400">
                      Aucun membre trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-[#00236f]/10 text-[#00236f] flex items-center justify-center font-bold text-xs">
                            {(m.prenom?.[0] || "?")}{(m.nom?.[0] || "?")}
                          </div>
                          <div>
                            <div className="font-bold text-slate-800">{m.prenom} {m.nom}</div>
                            <div className="text-xs text-slate-500">{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {m.profils_types ? (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_MAP[m.profils_types.slug]?.color}`}>
                            {ROLE_MAP[m.profils_types.slug]?.label}
                          </span>
                        ) : (
                          <span className="text-slate-400">Aucun rôle</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="relative group">
                          <button className="p-1.5 text-slate-400 hover:text-[#00236f] hover:bg-slate-100 rounded-md transition-colors">
                            <MoreVertical className="w-5 h-5" />
                          </button>
                          <div className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-lg shadow-lg hidden group-hover:block z-10">
                            <div className="p-2">
                              {Object.entries(ROLE_MAP).map(([roleSlug, roleData]) => (
                                <button
                                  key={roleSlug}
                                  onClick={() => handleRoleChange(m.id, roleSlug)}
                                  disabled={updating === m.id}
                                  className="w-full text-left px-3 py-2 text-sm rounded hover:bg-slate-100 transition-colors disabled:opacity-50"
                                >
                                  {updating === m.id ? (
                                    <Loader className="w-3 h-3 inline mr-2 animate-spin" />
                                  ) : null}
                                  {roleData.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-500">
          Total: {filteredMembers.length} membre(s)
        </div>

      </div>
    </div>
  )
}
