"use client"

import { useState, useEffect, useRef } from "react"
import { Search, MoreVertical, Loader, ExternalLink, ShieldCheck, ShieldAlert, CheckCircle2, Clock, XCircle, Ban, X } from "lucide-react"
import Link from "next/link"
import { getAllMembers, updateMemberRole, getAllRoles } from "@/lib/actions/members"
import type { PersonneWithRole, ProfilType } from "@/types/database.types"
import { Badge } from "@/components/ui/badge"
import { PostesMultiSelect } from "./_components/PostesMultiSelect"

// Couleurs des badges par slug de rôle de base (le libellé affiché vient de la
// DB via profils_types.nom ; ici on ne pilote que la couleur).
const ROLE_MAP: Record<string, { label: string; color: string }> = {
  administrateur:    { label: "Administrateur",    color: "bg-red-50 text-red-700 border-red-200" },
  chef_de_projet:    { label: "Chef.fe de projet", color: "bg-blue-50 text-blue-700 border-blue-200" },
  membre_ajc:        { label: "Membre AJC",        color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  intervenant:       { label: "Intervenant",       color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  ancien_membre_agc: { label: "Ancien membre",     color: "bg-zinc-100 text-zinc-600 border-zinc-200" },
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
        className="p-1.5 text-zinc-400 hover:text-[#00236f] hover:bg-zinc-100 rounded-md transition-colors disabled:opacity-50"
      >
        {updating === member.id
          ? <Loader className="w-5 h-5 animate-spin" />
          : <MoreVertical className="w-5 h-5" />}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-64 bg-white border border-zinc-200 rounded-xl shadow-xl z-20">
          <p className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Changer le rôle
          </p>
          <div className="p-1.5">
            {roles.filter((r) => (r.categorie ?? "base") === "base").map((r) => (
              <button
                key={r.slug}
                onClick={() => { setOpen(false); onRoleChange(member.id, r.slug) }}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-zinc-100 transition-colors flex items-center gap-2 ${
                  member.profils_types?.slug === r.slug ? "font-semibold text-[#00236f]" : "text-zinc-700"
                }`}
              >
                {member.profils_types?.slug === r.slug && (
                  <span className="material-symbols-outlined text-base text-[#00236f]">check</span>
                )}
                {r.nom}
              </button>
            ))}
          </div>
          <div className="border-t border-zinc-100 px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Postes (bureau / pôles)
            </p>
            <PostesMultiSelect
              personneId={member.id}
              postes={roles.filter((r) => r.categorie === "bureau" || r.categorie === "pole")}
              initialPosteIds={(member.personne_postes ?? [])
                .map((pp) => pp.profils_types?.id)
                .filter((id): id is string => Boolean(id))}
            />
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
  const [rejectTarget, setRejectTarget] = useState<PersonneWithRole | null>(null)

  async function patchStatus(id: string, account_status: string, rejection_reason?: string) {
    setUpdating(id)
    const res = await fetch(`/api/admin/personnes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_status, rejection_reason }),
    })
    if (res.ok) await loadMembers()
    else alert("Erreur lors de la mise à jour du compte")
    setUpdating(null)
  }

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

  const pendingCount = members.filter(m => m.account_status === "pending_validation").length

  return (
    <div className="p-8 h-full flex flex-col space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Membres & Validation</h1>
          <p className="text-zinc-500 text-sm mt-1">Gérez les comptes utilisateurs et validez les nouveaux membres.</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200 text-sm font-semibold">
            <ShieldAlert className="w-4 h-4" />
            {pendingCount} compte{pendingCount > 1 ? "s" : ""} en attente de validation
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm flex-1 flex flex-col">
        
        {/* TOOLBAR */}
        <div className="p-4 border-b border-zinc-100 flex flex-col lg:flex-row justify-between gap-4 bg-zinc-50">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Rôle</label>
              <div className="flex bg-white border border-zinc-200 rounded-lg p-1 flex-wrap gap-1">
                {["Tous", ...allRoles.map(r => r.slug)].map((f) => (
                  <button
                    key={f}
                    onClick={() => setRoleFilter(f)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      roleFilter === f ? "bg-[#00236f] text-white" : "text-zinc-500 hover:text-zinc-700"
                    }`}
                  >
                    {f === "Tous" ? "Tous" : (allRoles.find(r => r.slug === f)?.nom ?? f)}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">Statut Compte</label>
              <div className="flex bg-white border border-zinc-200 rounded-lg p-1 gap-1">
                {[
                  { value: "Tous", label: "Tous" },
                  { value: "pending_validation", label: "En attente" },
                  { value: "validated", label: "Validés" },
                  { value: "rejected", label: "Rejetés" }
                ].map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setStatusFilter(s.value)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                      statusFilter === s.value ? "bg-[#00236f] text-white" : "text-zinc-500 hover:text-zinc-700"
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
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Rechercher un membre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 text-sm border border-zinc-200 rounded-lg w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              />
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <Loader className="w-8 h-8 animate-spin text-zinc-300 mx-auto mb-2" />
                <p className="text-sm text-zinc-400">Chargement des membres...</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-zinc-500 uppercase bg-zinc-50/50 border-b border-zinc-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Membre</th>
                  <th className="px-6 py-4 font-semibold">Rôle</th>
                  <th className="px-6 py-4 font-semibold">Statut Compte</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-zinc-400">
                      Aucun membre trouvé.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => (
                    <tr key={m.id} className="hover:bg-zinc-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#00236f]/10 text-[#00236f] flex items-center justify-center font-bold text-sm shrink-0">
                            {(m.prenom?.[0] ?? "?").toUpperCase()}{(m.nom?.[0] ?? "").toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-zinc-800">
                              {m.prenom || ""} {m.nom || ""}
                            </div>
                            <div className="text-xs text-zinc-500">{m.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {m.profils_types ? (
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${ROLE_MAP[m.profils_types.slug]?.color ?? "bg-purple-50 text-purple-700 border-purple-200"}`}>
                            {m.profils_types.nom}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-400 italic">Aucun rôle</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {m.account_status === "validated" ? (
                          <div className="flex items-center gap-1.5 text-emerald-600 font-medium text-xs">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Validé
                          </div>
                        ) : m.account_status === "rejected" ? (
                          <div className="flex items-center gap-1.5 text-red-600 font-medium text-xs" title={(m as any).rejection_reason || undefined}>
                            <XCircle className="w-3.5 h-3.5" />
                            Rejeté
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
                              onClick={() => patchStatus(m.id, "validated")}
                              disabled={updating === m.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all bg-[#00236f] text-white hover:bg-[#1e3a8a] shadow-sm disabled:opacity-50"
                            >
                              <ShieldCheck className="w-3.5 h-3.5" />
                              Valider le compte
                            </button>
                          )}
                          {m.account_status === "pending_validation" && (
                            <button
                              onClick={() => setRejectTarget(m)}
                              disabled={updating === m.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 disabled:opacity-50"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              Rejeter
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

        <div className="px-6 py-3 border-t border-zinc-100 bg-zinc-50 text-xs text-zinc-400">
          {filteredMembers.length} membre{filteredMembers.length > 1 ? "s" : ""} affiché{filteredMembers.length > 1 ? "s" : ""}
        </div>
      </div>

      {rejectTarget && (
        <RejectModal
          member={rejectTarget}
          submitting={updating === rejectTarget.id}
          onClose={() => setRejectTarget(null)}
          onConfirm={async (reason) => {
            await patchStatus(rejectTarget.id, "rejected", reason)
            setRejectTarget(null)
          }}
        />
      )}
    </div>
  )
}

function RejectModal({ member, submitting, onClose, onConfirm }: {
  member: PersonneWithRole
  submitting: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState("")

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100">
          <h2 className="font-manrope font-bold text-red-600 text-lg flex items-center gap-2">
            <Ban className="w-5 h-5" /> Rejeter le compte
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-zinc-600">
            Vous êtes sur le point de rejeter le compte de{" "}
            <span className="font-semibold text-zinc-800">{member.prenom} {member.nom}</span>.
          </p>
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1">
              Commentaire (optionnel)
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Motif du rejet — laissez vide si aucun."
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg">
              Annuler
            </button>
            <button
              onClick={() => onConfirm(reason)}
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {submitting && <Loader className="h-4 w-4 animate-spin" />}
              Confirmer le rejet
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
