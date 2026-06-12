"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { ArrowLeft, GripVertical } from "lucide-react"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import { updateProposalStatus, signProposal } from "@/lib/actions/propositions"

export type PipelineProposal = {
  id: string
  client_company: string
  study_type: string | null
  status: string
  budget_status: string | null
  total_ht: number
  created_at: string
}

// Colonnes du pipeline, dans l'ordre du cycle de vie d'une propale.
const COLUMNS: { key: string; label: string; accent: string }[] = [
  { key: "brouillon", label: "Brouillon", accent: "border-t-zinc-400" },
  { key: "envoyée", label: "Envoyée", accent: "border-t-blue-500" },
  { key: "validée", label: "Validée", accent: "border-t-emerald-500" },
  { key: "CE éditée", label: "CE éditée", accent: "border-t-purple-500" },
  { key: "CE signée", label: "CE signée", accent: "border-t-primary" },
  { key: "refusée", label: "Refusée", accent: "border-t-red-400" },
]

const fmtEUR = (n: number) =>
  new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n || 0)

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })

export function PipelineClient({
  initialProposals,
}: {
  initialProposals: PipelineProposal[]
}) {
  const [proposals, setProposals] = useState(initialProposals)
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function moveTo(id: string, target: string) {
    const prop = proposals.find((p) => p.id === id)
    if (!prop || prop.status === target) return

    // La signature d'une CE crée automatiquement l'étude réelle : on garde la
    // confirmation explicite et l'action dédiée (mêmes règles que le Dashboard).
    if (target === "CE signée") {
      if (
        !confirm(
          `Signer la CE de « ${prop.client_company} » ?\n\nUne étude réelle sera créée automatiquement (phases, échéancier, missions, budget et client).`
        )
      )
        return
    }

    const previous = proposals
    setProposals((ps) => ps.map((p) => (p.id === id ? { ...p, status: target } : p)))

    startTransition(async () => {
      const res =
        target === "CE signée"
          ? await signProposal(id)
          : await updateProposalStatus(id, target)
      if (res && "error" in res && res.error) {
        setProposals(previous)
        toast.error(res.error)
      } else if (target === "CE signée") {
        toast.success("CE signée — étude créée automatiquement.")
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-manrope text-2xl font-extrabold text-primary">
            Pipeline de prospection
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Glissez une proposition d&apos;une colonne à l&apos;autre pour changer son statut.
          </p>
        </div>
        <Link
          href="/prospection"
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-input bg-background px-3 text-sm font-medium shadow-sm shadow-black/5 transition-colors hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Vue liste
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const items = proposals.filter((p) => p.status === col.key)
          const total = items.reduce((s, p) => s + (p.total_ht || 0), 0)
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault()
                setOverCol(col.key)
              }}
              onDragLeave={() => setOverCol(null)}
              onDrop={(e) => {
                e.preventDefault()
                setOverCol(null)
                const id = e.dataTransfer.getData("text/plain")
                if (id) moveTo(id, col.key)
              }}
              className={cn(
                "flex w-64 shrink-0 flex-col rounded-xl border border-t-4 bg-muted/40 transition-colors",
                col.accent,
                overCol === col.key && "bg-accent ring-2 ring-ring/30"
              )}
            >
              <div className="flex items-baseline justify-between px-3 pb-1 pt-3">
                <span className="text-sm font-semibold text-foreground">
                  {col.label}{" "}
                  <span className="font-normal text-muted-foreground">
                    ({items.length})
                  </span>
                </span>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {fmtEUR(total)}
                </span>
              </div>

              <div className="flex min-h-[120px] flex-col gap-2 p-2">
                {items.map((p) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", p.id)
                      setDragId(p.id)
                    }}
                    onDragEnd={() => setDragId(null)}
                    className={cn(
                      "cursor-grab rounded-lg border bg-card p-3 shadow-sm shadow-black/5 active:cursor-grabbing",
                      dragId === p.id && "opacity-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium text-card-foreground">
                        {p.client_company}
                      </p>
                      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
                    </div>
                    {p.study_type && (
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {p.study_type}
                      </p>
                    )}
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-sm font-semibold tabular-nums text-primary">
                        {fmtEUR(p.total_ht)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {fmtDate(p.created_at)}
                      </span>
                    </div>
                    {p.budget_status && p.budget_status !== "valide" && (
                      <span className="mt-2 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                        Budget {p.budget_status === "en_attente_validation" ? "en attente" : p.budget_status}
                      </span>
                    )}
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground/60">
                    Aucune proposition
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
