"use client"

import { useEffect, useState } from "react"
import { Loader2, Stamp, RefreshCw, UserCheck, Mail } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  listBureauQueue,
  delegateToTresorier,
  refreshSignatureStatus,
  type BureauQueueRow,
} from "@/lib/actions/signature"

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })

function daysLeft(expires: string | null): number | null {
  if (!expires) return null
  return Math.ceil((new Date(expires).getTime() - Date.now()) / 86_400_000)
}

export function BureauTab({ configured }: { configured: boolean }) {
  const [rows, setRows] = useState<BureauQueueRow[]>([])
  const [role, setRole] = useState<string>("admin")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  async function reload() {
    const res = await listBureauQueue()
    if ("error" in res) {
      toast.error(res.error)
      setRows([])
    } else {
      setRows(res.data)
      setRole(res.role)
    }
    setLoading(false)
  }

  useEffect(() => {
    reload()
  }, [])

  async function handleRefresh(id: string) {
    setBusy(id)
    const res = await refreshSignatureStatus(id)
    setBusy(null)
    if (res?.error) toast.error(res.error)
    else {
      toast.success("Statut actualisé.")
      reload()
    }
  }

  async function handleDelegate(id: string) {
    if (!confirm("Déléguer cette signature au trésorier ? La demande en cours sera abandonnée et renvoyée.")) return
    setBusy(id)
    const res = await delegateToTresorier(id)
    setBusy(null)
    if ("error" in res) toast.error(res.error)
    else {
      toast.success("Signature déléguée au trésorier.")
      reload()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-800 dark:border-blue-950 dark:bg-blue-950/30 dark:text-blue-300">
        <p className="flex items-start gap-2">
          <Mail className="mt-0.5 h-4 w-4 shrink-0" />
          Pour chaque document en attente, un email LiveConsent contenant le lien de signature
          sécurisé vous est envoyé. Cette file vous permet de suivre les documents qui attendent
          votre signature.
        </p>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm shadow-black/5">
        <div className="border-b px-6 py-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Stamp className="h-4 w-4 text-gold" /> Documents à signer ({rows.length})
          </h2>
        </div>
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            Aucun document en attente de signature.
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => {
              const left = daysLeft(r.expires_at)
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{r.request_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {r.document_filename}
                      {r.category === "ba" && " · Bulletin d'adhésion"}
                      {" · envoyé le "}
                      {fmtDate(r.created_at)}
                    </p>
                  </div>

                  {left != null && (
                    <Badge
                      className={cn(
                        left <= 2
                          ? "bg-red-100 text-red-700"
                          : left <= 7
                            ? "bg-amber-100 text-amber-800"
                            : "bg-zinc-100 text-zinc-600"
                      )}
                    >
                      {left > 0 ? `Expire dans ${left}j` : "Expiré"}
                    </Badge>
                  )}
                  <Badge className="bg-blue-50 text-blue-700">{r.status}</Badge>

                  <button
                    onClick={() => handleRefresh(r.id)}
                    disabled={busy === r.id || !configured}
                    title="Actualiser le statut"
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                  >
                    <RefreshCw className={cn("h-4 w-4", busy === r.id && "animate-spin")} />
                  </button>

                  {(role === "president" || role === "admin") && r.category === "ba" && (
                    <button
                      onClick={() => handleDelegate(r.id)}
                      disabled={busy === r.id || !configured}
                      title="Déléguer au trésorier"
                      className="flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-40"
                    >
                      <UserCheck className="h-3.5 w-3.5" /> Déléguer au trésorier
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
