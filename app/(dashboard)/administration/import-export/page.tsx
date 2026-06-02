"use client"

import { useState } from "react"
import { Download, Loader2, FileSpreadsheet, ArrowDownUp } from "lucide-react"
import { toast } from "sonner"

const EXPORTABLE = [
  { type: "membres", label: "Membres", desc: "Comptes, rôles et statuts" },
  { type: "clients", label: "Clients", desc: "Entreprises et contacts" },
  { type: "etudes", label: "Études", desc: "Études et budgets" },
  { type: "missions", label: "Missions", desc: "Missions et JEH" },
  { type: "factures", label: "Factures", desc: "Trésorerie / facturation" },
  { type: "propositions", label: "Propositions", desc: "Propales et statuts" },
]

export default function ImportExportPage() {
  const [busy, setBusy] = useState<string | null>(null)

  const exportOne = async (type: string) => {
    setBusy(type)
    try {
      const res = await fetch(`/api/admin/export?type=${type}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(err.error ?? "Échec de l'export", { position: "top-right" })
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `befast_${type}_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      a.remove()
    } catch {
      toast.error("Erreur réseau", { position: "top-right" })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-manrope font-black text-[#00236f] flex items-center gap-2">
          <ArrowDownUp className="w-6 h-6" /> Import / Export
        </h1>
        <p className="text-zinc-500 text-sm mt-1">Téléchargez vos données au format CSV (réservé aux administrateurs).</p>
      </div>

      {/* EXPORT */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm">
        <div className="bg-zinc-50 px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
          <Download className="w-5 h-5 text-[#00236f]" />
          <h2 className="font-bold text-zinc-800">Exporter les données</h2>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXPORTABLE.map((e) => (
            <div key={e.type} className="flex items-center justify-between gap-3 p-4 rounded-lg border border-zinc-200 hover:border-[#00236f]/30 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#00236f]/10 text-[#00236f] flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-800 truncate">{e.label}</p>
                  <p className="text-xs text-zinc-400 truncate">{e.desc}</p>
                </div>
              </div>
              <button
                onClick={() => exportOne(e.type)}
                disabled={busy === e.type}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[#00236f] text-white hover:bg-[#1e3a8a] transition-colors disabled:opacity-50 shrink-0"
              >
                {busy === e.type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                CSV
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* IMPORT (placeholder) */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm mt-6">
        <div className="bg-zinc-50 px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
          <FileSpreadsheet className="w-5 h-5 text-zinc-400" />
          <h2 className="font-bold text-zinc-800">Importer des données</h2>
        </div>
        <div className="p-5 text-sm text-zinc-400">Import par fichier (.xlsx / .csv) — à venir.</div>
      </div>
    </div>
  )
}
