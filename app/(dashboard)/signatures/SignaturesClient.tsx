"use client"

import { useRef, useState, useTransition } from "react"
import { AlertTriangle, FileSignature, Loader2, RefreshCw, Send } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  sendDocumentForSignature,
  refreshSignatureStatus,
  type SignatureRequestRow,
} from "@/lib/actions/signature"

const STATUS_STYLES: Record<string, string> = {
  envoyee: "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
  signed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  completed: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  abandoned: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  expired: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
}

const fmtDateTime = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })

export function SignaturesClient({
  configured,
  initialRequests,
  loadError,
}: {
  configured: boolean
  initialRequests: SignatureRequestRow[]
  loadError: string | null
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [isPending, startTransition] = useTransition()
  const [refreshing, setRefreshing] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await sendDocumentForSignature(formData)
      if (res?.error) {
        toast.error(res.error)
      } else {
        toast.success("Document envoyé en signature via LiveConsent.")
        formRef.current?.reset()
      }
    })
  }

  async function handleRefresh(id: string) {
    setRefreshing(id)
    const res = await refreshSignatureStatus(id)
    setRefreshing(null)
    if (res?.error) toast.error(res.error)
    else toast.success(`Statut actualisé : ${(res as any).status}`)
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-manrope text-2xl font-extrabold text-primary">
          Signatures électroniques
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Envoyez un document PDF (convention d&apos;étude, RDM…) en signature via LiveConsent
          et suivez son avancement.
        </p>
      </div>

      {!configured && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            LiveConsent n&apos;est pas configuré. Renseignez{" "}
            <code className="rounded bg-amber-100 px-1 font-mono text-xs dark:bg-amber-900/50">
              LIVECONSENT_USERNAME
            </code>
            ,{" "}
            <code className="rounded bg-amber-100 px-1 font-mono text-xs dark:bg-amber-900/50">
              LIVECONSENT_DEVELOPER_KEY
            </code>{" "}
            et{" "}
            <code className="rounded bg-amber-100 px-1 font-mono text-xs dark:bg-amber-900/50">
              LIVECONSENT_SECRET_KEY
            </code>{" "}
            dans les variables d&apos;environnement (Vercel) pour activer l&apos;envoi.
          </p>
        </div>
      )}

      {/* ── Formulaire d'envoi ──────────────────────────────────────── */}
      <form
        ref={formRef}
        action={handleSubmit}
        className="rounded-2xl border bg-card p-6 shadow-sm shadow-black/5"
      >
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
          <FileSignature className="h-4 w-4 text-gold" /> Nouvelle demande de signature
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="file">Document PDF (max 7 Mo)</Label>
            <Input id="file" name="file" type="file" accept="application/pdf" required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="requestName">Nom de la demande</Label>
            <Input
              id="requestName"
              name="requestName"
              placeholder="CE 24-07 — Acme Corp"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="firstname">Prénom du signataire</Label>
            <Input id="firstname" name="firstname" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastname">Nom du signataire</Label>
            <Input id="lastname" name="lastname" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email du signataire</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone (requis par LiveConsent)</Label>
            <Input id="phone" name="phone" type="tel" placeholder="+33612345678" required />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="message">Message (optionnel)</Label>
            <Input id="message" name="message" placeholder="Merci de signer avant vendredi." />
          </div>
        </div>

        <Button type="submit" disabled={isPending || !configured} className="mt-6">
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Envoi…
            </>
          ) : (
            <>
              <Send className="h-4 w-4" /> Envoyer en signature
            </>
          )}
        </Button>
      </form>

      {/* ── Suivi des demandes ──────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card shadow-sm shadow-black/5">
        <div className="border-b px-6 py-4">
          <h2 className="text-sm font-semibold text-foreground">
            Demandes envoyées ({initialRequests.length})
          </h2>
        </div>
        {loadError ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            Impossible de charger les demandes : {loadError}. La table{" "}
            <code className="rounded bg-muted px-1 font-mono text-xs">signature_requests</code>{" "}
            existe-t-elle ? (migration 037 dans MIGRATIONS_A_APPLIQUER.sql)
          </p>
        ) : initialRequests.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-muted-foreground">
            Aucune demande de signature pour le moment.
          </p>
        ) : (
          <ul className="divide-y">
            {initialRequests.map((r) => (
              <li key={r.id} className="flex items-center gap-4 px-6 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {r.request_name}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.document_filename} →{" "}
                    {[r.recipient_firstname, r.recipient_lastname].filter(Boolean).join(" ")}{" "}
                    ({r.recipient_email})
                  </p>
                </div>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium",
                    STATUS_STYLES[r.status?.toLowerCase?.()] ??
                      "bg-muted text-muted-foreground"
                  )}
                >
                  {r.status}
                </span>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                  {fmtDateTime(r.last_event_at ?? r.created_at)}
                </span>
                <button
                  onClick={() => handleRefresh(r.id)}
                  disabled={refreshing === r.id || !configured}
                  title="Actualiser le statut depuis LiveConsent"
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
                >
                  <RefreshCw
                    className={cn("h-4 w-4", refreshing === r.id && "animate-spin")}
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
