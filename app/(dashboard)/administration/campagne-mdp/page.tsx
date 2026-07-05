"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader, RefreshCw, Search, MailCheck, KeyRound, Clock, Users, Send } from "lucide-react"
import { toast } from "sonner"
import {
  getCampaignStatus,
  sendPasswordSetupBatch,
  sendPasswordSetupSingle,
  type CampaignStatus,
  type CampaignMember,
} from "@/lib/actions/password-campaign"

function fmt(d: string | null): string {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function statusOf(m: CampaignMember): { label: string; className: string } {
  if (m.setAt) return { label: "Réinitialisé", className: "bg-emerald-50 text-emerald-700 border-emerald-200" }
  if (m.sentAt) return { label: "Contacté", className: "bg-blue-50 text-blue-700 border-blue-200" }
  return { label: "En attente", className: "bg-amber-50 text-amber-700 border-amber-200" }
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4">
      <div className={`flex size-10 items-center justify-center rounded-lg ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-2xl font-bold text-zinc-900">{value}</div>
        <div className="text-xs text-zinc-500">{label}</div>
      </div>
    </div>
  )
}

export default function CampagneMdpPage() {
  const [status, setStatus] = useState<CampaignStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [filter, setFilter] = useState<"all" | "pending" | "sent" | "set">("all")
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [sending, setSending] = useState(false)
  const [sendingId, setSendingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data, error } = await getCampaignStatus()
    setStatus(data)
    setError(error)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  // Envoi manuel du prochain lot (100) de mails « définis ton mot de passe »
  // aux comptes migrés en attente. Le filtre d'affichage n'affecte PAS la cible.
  async function handleSend() {
    if (!status || status.pending === 0 || sending) return
    const n = Math.min(status.pending, 100)
    if (
      !window.confirm(
        `Envoyer le mail « définis ton mot de passe » à ${n} compte(s) migré(s) en attente ?\n\n` +
          `(Le filtre d'affichage ci-dessous ne change pas la cible : l'envoi vise toujours les comptes migrés pas encore contactés.)`
      )
    )
      return
    setSending(true)
    const res = await sendPasswordSetupBatch(100)
    setSending(false)
    if (res.error) {
      toast.error(res.error, { position: "top-right", duration: 6000 })
      return
    }
    toast.success(
      `${res.sent} email(s) envoyé(s)${res.failed ? ` · ${res.failed} échec(s)` : ""}.`,
      { position: "top-right", duration: 6000 }
    )
    load()
  }

  // Envoi individuel pour un membre précis (bouton par ligne).
  async function handleSendOne(member: CampaignMember) {
    if (sendingId) return
    setSendingId(member.id)
    const res = await sendPasswordSetupSingle(member.id)
    setSendingId(null)
    if (res.error) {
      toast.error(`${member.prenom ?? member.email} : ${res.error}`, { position: "top-right", duration: 6000 })
      return
    }
    toast.success(`Email envoyé à ${member.prenom ?? member.email}.`, { position: "top-right", duration: 4000 })
    load()
  }

  // Rôles présents parmi les comptes migrés (pour le filtre d'affichage).
  const roles = useMemo(() => {
    if (!status) return [] as string[]
    return Array.from(
      new Set(status.members.map((m) => m.roleName).filter((r): r is string => !!r))
    ).sort((a, b) => a.localeCompare(b, "fr"))
  }, [status])

  const rows = useMemo(() => {
    if (!status) return []
    const q = query.trim().toLowerCase()
    return status.members.filter((m) => {
      if (filter === "pending" && m.sentAt) return false
      if (filter === "sent" && !(m.sentAt && !m.setAt)) return false
      if (filter === "set" && !m.setAt) return false
      if (roleFilter !== "all" && m.roleName !== roleFilter) return false
      if (!q) return true
      return (
        m.email.toLowerCase().includes(q) ||
        `${m.prenom ?? ""} ${m.nom ?? ""}`.toLowerCase().includes(q)
      )
    })
  }, [status, query, filter, roleFilter])

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900">Campagne mot de passe</h1>
          <p className="text-sm text-zinc-500">
            Suivi des emails « définir mon mot de passe » envoyés aux comptes migrés.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSend}
            disabled={sending || loading || !status || status.pending === 0}
            className="flex items-center gap-2 rounded-lg bg-[#00236f] px-3 py-2 text-sm font-medium text-white hover:bg-[#001a54] disabled:opacity-50"
          >
            {sending ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {sending
              ? "Envoi…"
              : `Envoyer le prochain lot${
                  status && status.pending ? ` (${Math.min(status.pending, 100)})` : ""
                }`}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Rafraîchir
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Loader className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      )}

      {!loading && error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</div>
      )}

      {!loading && status && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatCard icon={Users} label="Comptes migrés" value={status.total} color="bg-zinc-100 text-zinc-700" />
            <StatCard icon={MailCheck} label="Contactés" value={status.sent} color="bg-blue-50 text-blue-700" />
            <StatCard icon={KeyRound} label="Réinitialisés" value={status.set} color="bg-emerald-50 text-emerald-700" />
            <StatCard icon={Clock} label="En attente d'envoi" value={status.pending} color="bg-amber-50 text-amber-700" />
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher un nom ou email…"
                className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-sm focus:border-[#00236f] focus:outline-none"
              />
            </div>
            <div className="flex gap-1 rounded-lg bg-zinc-100 p-1">
              {([
                ["all", "Tous"],
                ["pending", "En attente"],
                ["sent", "Contactés"],
                ["set", "Réinitialisés"],
              ] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    filter === key ? "bg-white text-[#00236f] shadow-sm" : "text-zinc-500 hover:text-zinc-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-lg border border-zinc-200 py-2 px-3 text-sm text-zinc-600 focus:border-[#00236f] focus:outline-none"
            >
              <option value="all">Tous les rôles</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Membre</th>
                  <th className="px-4 py-3 font-medium">Rôle</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">Contacté le</th>
                  <th className="px-4 py-3 font-medium">Réinitialisé le</th>
                  <th className="px-4 py-3 font-medium text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {rows.map((m) => {
                  const s = statusOf(m)
                  return (
                    <tr key={m.id} className="hover:bg-zinc-50">
                      <td className="px-4 py-2.5 font-medium text-zinc-800">
                        {`${m.prenom ?? ""} ${m.nom ?? ""}`.trim() || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-600">{m.roleName ?? "—"}</td>
                      <td className="px-4 py-2.5 text-zinc-600">{m.email}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500">{fmt(m.sentAt)}</td>
                      <td className="px-4 py-2.5 text-zinc-500">{fmt(m.setAt)}</td>
                      <td className="px-4 py-2.5 text-center">
                        {!m.sentAt ? (
                          <button
                            onClick={() => handleSendOne(m)}
                            disabled={sendingId !== null}
                            title={`Envoyer le mail à ${m.email}`}
                            className="inline-flex items-center justify-center rounded-lg border border-zinc-200 p-1.5 text-zinc-500 hover:bg-[#00236f] hover:text-white hover:border-[#00236f] disabled:opacity-40 transition-colors"
                          >
                            {sendingId === m.id ? (
                              <Loader className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          <span className="text-zinc-300">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-zinc-400">
                      Aucun membre à afficher.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-400">{rows.length} membre(s) affiché(s)</p>
        </>
      )}
    </div>
  )
}
