"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2, Save, Search, ChevronLeft, Layers, Gauge } from "lucide-react"
import { getPhasesDefaut, savePhaseDefaut, getPrixJehBrutMoyen, type PhaseDefaut } from "@/lib/actions/phases"
import { toast } from "sonner"

export default function PilotagePhasesPage() {
  const [phases, setPhases] = useState<PhaseDefaut[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [savingId, setSavingId] = useState<number | null>(null)
  const [brutMoyen, setBrutMoyen] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([getPhasesDefaut(), getPrixJehBrutMoyen()]).then(([pres, bres]) => {
      if (pres.error) setError(pres.error)
      else setPhases(pres.data ?? [])
      if (bres.data != null) setBrutMoyen(bres.data)
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return phases
    return phases.filter((p) => `${p.nom} ${p.objectifs ?? ""}`.toLowerCase().includes(q))
  }, [phases, search])

  const patch = (id: number, field: keyof PhaseDefaut, value: any) =>
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)))

  const handleSave = async (phase: PhaseDefaut) => {
    setSavingId(phase.id)
    const res = await savePhaseDefaut(phase)
    setSavingId(null)
    if (res.success) toast.success(`Phase « ${phase.nom} » enregistrée`, { position: "top-right" })
    else toast.error(res.error ?? "Erreur", { position: "top-right" })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 animate-spin text-[#00236f]" />
      </div>
    )
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href="/prospection" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-[#00236f] mb-1">
            <ChevronLeft className="w-4 h-4" /> Retour à la prospection
          </Link>
          <h1 className="text-2xl font-manrope font-black text-[#00236f] flex items-center gap-2">
            <Layers className="w-6 h-6" /> Pilotage des phases
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Personnalisez le JEH par défaut, le nombre moyen d'intervenants et le contenu de chaque phase.
          </p>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm px-5 py-3 flex items-center gap-3">
          <Gauge className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Prix JEH brut moyen</p>
            <p className="text-lg font-manrope font-black text-[#00236f]">
              {brutMoyen != null ? `${brutMoyen.toLocaleString("fr-FR")} €` : "—"}
            </p>
            <p className="text-[10px] text-zinc-400">hors marge, sur études signées</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">Impossible de charger les phases.</p>
          <p>Vérifie que la migration <code className="font-mono">029_provenance_phases_budget.sql</code> est appliquée.</p>
          <p className="text-xs font-mono mt-2 bg-amber-100 p-2 rounded">{error}</p>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une phase…"
          className="w-full h-11 pl-9 pr-4 rounded-lg bg-white border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
        />
      </div>

      <div className="space-y-4">
        {filtered.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-zinc-200 shadow-sm p-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 rounded-full bg-[#00236f]/10 text-[#00236f] flex items-center justify-center font-bold text-sm shrink-0">{p.id}</span>
              <input
                value={p.nom}
                onChange={(e) => patch(p.id, "nom", e.target.value)}
                className="font-bold text-lg text-zinc-800 flex-1 border-none bg-transparent focus:ring-0 p-0 outline-none"
              />
              <button
                onClick={() => handleSave(p)}
                disabled={savingId === p.id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[#00236f] text-white hover:bg-[#1e3a8a] disabled:opacity-50 shrink-0"
              >
                {savingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Enregistrer
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <NumField label="JEH par défaut (€)" value={p.jeh_defaut} onChange={(v) => patch(p.id, "jeh_defaut", v)} />
              <NumField label="Intervenants moyen" value={p.intervenants_defaut} onChange={(v) => patch(p.id, "intervenants_defaut", v)} />
              <NumField label="Durée (semaines)" value={p.duree_semaines} onChange={(v) => patch(p.id, "duree_semaines", v)} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <TextArea label="Objectifs" value={p.objectifs ?? ""} onChange={(v) => patch(p.id, "objectifs", v)} />
              <TextArea label="Méthodologie" value={p.methodologie ?? ""} onChange={(v) => patch(p.id, "methodologie", v)} />
              <TextArea label="Contraintes" value={p.contraintes ?? ""} onChange={(v) => patch(p.id, "contraintes", v)} />
            </div>
          </div>
        ))}
        {filtered.length === 0 && !error && (
          <p className="text-center text-zinc-400 text-sm py-10">Aucune phase trouvée.</p>
        )}
      </div>
    </div>
  )
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500 mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-10 px-3 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
      />
    </div>
  )
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 resize-none"
      />
    </div>
  )
}
