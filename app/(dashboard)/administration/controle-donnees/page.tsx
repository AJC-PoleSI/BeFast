"use client"

import { useEffect, useState } from "react"
import { Save, Loader2, SlidersHorizontal, Euro, FileText, Gauge } from "lucide-react"
import { getParametres, saveParametres, getMargesRecommandees, saveMargesRecommandees } from "@/lib/actions/parametres"
import { TAILLES_ENTREPRISE, type ParametresMap, type MargesMap } from "@/lib/proposals-constants"
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
  const [marges, setMarges] = useState<MargesMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getParametres(), getMargesRecommandees()]).then(([res, mres]) => {
      if (res.error) setError(res.error)
      else setValues(res.data ?? {})
      if (mres.data) setMarges(mres.data)
      setLoading(false)
    })
  }, [])

  const set = (key: string, v: string) => setValues((prev) => ({ ...prev, [key]: v }))
  const setMarge = (taille: string, v: string) => setMarges((prev) => ({ ...prev, [taille]: v === "" ? 0 : Number(v) }))

  const handleSave = async () => {
    setSaving(true)
    const [res, mres] = await Promise.all([saveParametres(values), saveMargesRecommandees(marges)])
    setSaving(false)
    if (res.success && mres.success) toast.success("Paramètres enregistrés", { position: "top-right" })
    else toast.error(res.error ?? mres.error ?? "Erreur", { position: "top-right" })
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
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-all shadow-sm disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer
        </button>
      </div>

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

        {/* MARGES RECOMMANDÉES PAR TAILLE D'ENTREPRISE */}
        <Section icon={<Gauge className="w-5 h-5 text-[#00236f]" />} title="Marges recommandées par taille d'entreprise" full>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-5">
            {TAILLES_ENTREPRISE.map((t) => (
              <div key={t}>
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wide capitalize">{t}</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    value={marges[t] ?? ""}
                    onChange={(e) => setMarge(t, e.target.value)}
                    className="w-full h-10 px-3 pr-8 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all"
                  />
                  <span className="absolute right-3 top-2.5 text-zinc-400 text-sm">%</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-400 mt-4">
            Dans le générateur de propositions, choisir une taille de structure applique automatiquement la marge JE correspondante.
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
