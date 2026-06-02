"use client"

import { useEffect, useState } from "react"
import { Save, Loader2, SlidersHorizontal, Euro, FileText, Gauge, Download, X } from "lucide-react"
import { getParametres, saveParametres, type ParametresMap } from "@/lib/actions/parametres"
import { toast } from "sonner"

// Champs pilotables, regroupés par section. `key` = clé dans la table parametres.
const PRIX_FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: "prix_jeh_moyen", label: "Prix JEH moyen (€)", hint: "Valeur par défaut d'une JEH de phase" },
  { key: "prix_suivi_jeh_moyen", label: "Prix JEH suivi CDP (€)" },
  { key: "frais_dossier_moyen", label: "Frais de dossier (€)" },
  { key: "marge_je_moyenne_pct", label: "Marge JE par défaut (%)" },
]

const FOURCHETTE_FIELDS: { key: string; label: string }[] = [
  { key: "prix_jeh_min", label: "Prix JEH minimum (€)" },
  { key: "prix_jeh_max", label: "Prix JEH maximum (€)" },
]

const CONTENU_FIELDS: { key: string; label: string }[] = [
  { key: "propale_context_situation_default", label: "Contexte — Votre situation" },
  { key: "propale_context_intervention_default", label: "Contexte — Notre domaine d'intervention" },
  { key: "propale_context_enjeu_default", label: "Contexte — L'enjeu" },
  { key: "propale_cdc_objectifs_default", label: "Cahier des charges — Objectifs globaux" },
  { key: "propale_cdc_contraintes_default", label: "Cahier des charges — Contraintes globales" },
  { key: "propale_cdc_livrables_default", label: "Cahier des charges — Livrables attendus" },
]

export default function ControleDonneesPage() {
  const [values, setValues] = useState<ParametresMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showExport, setShowExport] = useState(false)

  useEffect(() => {
    getParametres().then((res) => {
      if (res.error) setError(res.error)
      else setValues(res.data ?? {})
      setLoading(false)
    })
  }, [])

  const set = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }))

  const handleSave = async () => {
    setSaving(true)
    const res = await saveParametres(values)
    setSaving(false)
    if (res.success) toast.success("Paramètres enregistrés", { position: "top-right" })
    else toast.error(res.error ?? "Erreur", { position: "top-right" })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 animate-spin text-[#00236f]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          <p className="font-semibold mb-1">Impossible de charger les paramètres.</p>
          <p>
            Assure-toi que la migration{" "}
            <code className="px-1.5 py-0.5 bg-amber-100 rounded text-xs font-mono">027_rejet_budget_parametres.sql</code>{" "}
            a bien été appliquée.
          </p>
          <p className="text-xs font-mono mt-2 bg-amber-100 p-2 rounded">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-manrope font-black text-[#00236f] flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6" /> Contrôle des données
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Pilotez les valeurs par défaut des propositions, les prix moyens et les fourchettes de prix.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-zinc-200 text-[#00236f] text-sm font-semibold hover:bg-zinc-50 transition-all shadow-sm"
          >
            <Download className="w-4 h-4" />
            Exporter les données
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-all shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
        </div>
      </div>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-8">
        {/* PRIX MOYENS */}
        <Section icon={<Euro className="w-5 h-5 text-[#00236f]" />} title="Prix moyens">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            {PRIX_FIELDS.map((f) => (
              <NumField key={f.key} field={f} value={values[f.key] ?? ""} onChange={(v) => set(f.key, v)} />
            ))}
          </div>
        </Section>

        {/* FOURCHETTES */}
        <Section icon={<Gauge className="w-5 h-5 text-[#00236f]" />} title="Fourchettes de prix (JEH)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            {FOURCHETTE_FIELDS.map((f) => (
              <NumField key={f.key} field={f} value={values[f.key] ?? ""} onChange={(v) => set(f.key, v)} />
            ))}
          </div>
          <p className="text-xs text-zinc-400 mt-4">
            Ces bornes servent de garde-fou indicatif lors de la saisie du prix JEH dans une proposition.
          </p>
        </Section>

        {/* CONTENU PAR DÉFAUT DES PROPALES */}
        <Section icon={<FileText className="w-5 h-5 text-[#00236f]" />} title="Contenu par défaut des propositions" full>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            {CONTENU_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wide">{f.label}</label>
                <textarea
                  value={values[f.key] ?? ""}
                  onChange={(e) => set(f.key, e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 resize-none"
                />
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}

const EXPORTABLE = [
  { type: "membres", label: "Membres" },
  { type: "clients", label: "Clients" },
  { type: "etudes", label: "Études" },
  { type: "missions", label: "Missions" },
  { type: "factures", label: "Factures (trésorerie)" },
  { type: "propositions", label: "Propositions" },
]

function ExportModal({ onClose }: { onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>(EXPORTABLE.map((e) => e.type))
  const [busy, setBusy] = useState(false)

  const toggle = (type: string) =>
    setSelected((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))

  const handleExport = async () => {
    setBusy(true)
    for (const type of selected) {
      try {
        const res = await fetch(`/api/admin/export?type=${type}`)
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          toast.error(`${type} : ${err.error ?? "échec de l'export"}`, { position: "top-right" })
          continue
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
        toast.error(`${type} : erreur réseau`, { position: "top-right" })
      }
    }
    setBusy(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100">
          <h2 className="font-manrope font-bold text-[#00236f] text-lg flex items-center gap-2">
            <Download className="w-5 h-5" /> Exporter les données
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-zinc-600">Sélectionnez les jeux de données à télécharger au format CSV.</p>
          <div className="space-y-2">
            {EXPORTABLE.map((e) => (
              <label key={e.type} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-zinc-200 cursor-pointer hover:bg-zinc-50">
                <input
                  type="checkbox"
                  checked={selected.includes(e.type)}
                  onChange={() => toggle(e.type)}
                  className="w-4 h-4 rounded border-zinc-300 text-[#00236f] focus:ring-[#00236f]"
                />
                <span className="text-sm text-zinc-700">{e.label}</span>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg">Annuler</button>
            <button
              onClick={handleExport}
              disabled={busy || selected.length === 0}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#00236f] text-white rounded-lg hover:bg-[#1e3a8a] disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Télécharger ({selected.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ icon, title, children, full }: { icon: React.ReactNode; title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border border-zinc-200 overflow-hidden shadow-sm ${full ? "xl:col-span-2" : ""}`}>
      <div className="bg-zinc-50 px-5 py-4 border-b border-zinc-100 flex items-center gap-3">
        {icon}
        <h2 className="font-bold text-zinc-800">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function NumField({ field, value, onChange }: { field: { key: string; label: string; hint?: string }; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wide">{field.label}</label>
      <input
        type="number"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all"
      />
      {field.hint && <p className="text-xs text-zinc-400 mt-1">{field.hint}</p>}
    </div>
  )
}
