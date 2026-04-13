"use client"

import { useState } from "react"
import { Search, Filter, MoreVertical, ShieldAlert, UserCheck, Shield } from "lucide-react"

type MemberStatus = "Membres" | "Intervenants" | "Mandat" | "Anciens"

const MOCK_MEMBERS = [
  { id: 1, nom: "Dupont", prenom: "Jean", email: "j.dupont@befast.com", status: "Mandat", role: "Président" },
  { id: 2, nom: "Martin", prenom: "Alice", email: "a.martin@befast.com", status: "Mandat", role: "Trésorière" },
  { id: 3, nom: "Durand", prenom: "Paul", email: "p.durand@befast.com", status: "Membres", role: "Chef de Projet" },
  { id: 4, nom: "Lefebvre", prenom: "Marie", email: "m.lefebvre@befast.com", status: "Membres", role: "Auditrice" },
  { id: 5, nom: "Moreau", prenom: "Luc", email: "l.moreau@befast.com", status: "Intervenants", role: "Développeur Web" },
  { id: 6, nom: "Laurent", prenom: "Sophie", email: "s.laurent@befast.com", status: "Intervenants", role: "Designer UI/UX" },
  { id: 7, nom: "Rousseau", prenom: "Thomas", email: "t.rousseau@befast.com", status: "Anciens", role: "Ancien Président" },
]

export default function MemberManagementPage() {
  const [filter, setFilter] = useState<MemberStatus | "Tous">("Tous")
  const [search, setSearch] = useState("")

  const filteredMembers = MOCK_MEMBERS.filter(m => {
    // Statut filter
    if (filter !== "Tous" && m.status !== filter) return false
    // Search filter
    if (search && !`${m.nom} ${m.prenom} ${m.email}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Gestion des Membres</h1>
          <p className="text-slate-500 text-sm mt-1">Supervisez l'ensemble des profils et droits d'accès de votre équipe.</p>
        </div>
        <button className="px-5 py-2.5 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-all shadow-sm">
          + Inviter un membre
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm flex-1 flex flex-col">
        
        {/* TOOLBAR */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4 bg-slate-50">
          <div className="flex bg-white border border-slate-200 rounded-lg p-1">
            {["Tous", "Mandat", "Membres", "Intervenants", "Anciens"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  filter === f ? "bg-slate-100 text-slate-800" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher un membre..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all font-medium"
            />
          </div>
        </div>

        {/* DATA TABLE */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Membre</th>
                <th className="px-6 py-4 font-semibold">Statut</th>
                <th className="px-6 py-4 font-semibold">Rôle attribué</th>
                <th className="px-6 py-4 font-semibold">Accès système</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    Aucun membre trouvé correspondant à vos critères.
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-[#00236f]/10 text-[#00236f] flex items-center justify-center font-bold text-xs">
                          {m.prenom[0]}{m.nom[0]}
                        </div>
                        <div>
                          <div className="font-bold text-slate-800">{m.prenom} {m.nom}</div>
                          <div className="text-xs text-slate-500">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        m.status === "Mandat" ? "bg-amber-50 text-amber-700 border-amber-200" :
                        m.status === "Membres" ? "bg-blue-50 text-blue-700 border-blue-200" :
                        m.status === "Intervenants" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        "bg-slate-100 text-slate-600 border-slate-200"
                      }`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-medium text-slate-700">{m.role}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        {m.status === "Mandat" ? (
                          <span className="flex items-center text-xs text-amber-600 font-medium bg-amber-50 px-2 py-1 rounded-md">
                            <ShieldAlert className="w-3.5 h-3.5 mr-1" /> Admin
                          </span>
                        ) : m.status === "Membres" ? (
                          <span className="flex items-center text-xs text-blue-600 font-medium bg-blue-50 px-2 py-1 rounded-md">
                            <Shield className="w-3.5 h-3.5 mr-1" /> Standard
                          </span>
                        ) : m.status === "Intervenants" ? (
                          <span className="flex items-center text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-md">
                            <UserCheck className="w-3.5 h-3.5 mr-1" /> Restreint
                          </span>
                        ) : (
                          <span className="flex items-center text-xs text-slate-500 font-medium bg-slate-100 px-2 py-1 rounded-md">
                            Aucun
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="p-1.5 text-slate-400 hover:text-[#00236f] hover:bg-slate-100 rounded-md transition-colors">
                        <MoreVertical className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* FOOTER */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex justify-between items-center">
          <span>Affichage de {filteredMembers.length} membre(s)</span>
          <div className="flex gap-1">
            <button className="px-3 py-1 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-50">Précédent</button>
            <button className="px-3 py-1 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-50">Suivant</button>
          </div>
        </div>

      </div>
    </div>
  )
}
