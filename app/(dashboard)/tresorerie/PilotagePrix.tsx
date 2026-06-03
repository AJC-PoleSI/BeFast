"use client"

import { useEffect, useState } from "react"
import { Save, Loader2, Euro, Gauge } from "lucide-react"
import { getParametres, saveParametres, getMargesRecommandees, saveMargesRecommandees, type ParametresMap, type MargesMap } from "@/lib/actions/parametres"
import { TAILLES_ENTREPRISE } from "@/lib/proposals-constants"
import { toast } from "sonner"

const PRIX_FIELDS = [
  { key: "prix_jeh_moyen", label: "Prix JEH moyen (€)", hint: "Valeur par défaut d'une JEH de phase" },
  { key: "prix_suivi_jeh_moyen", label: "Prix JEH suivi CDP (€)" },
  { key: "frais_dossier_moyen", label: "Frais de dossier (€)" },
  { key: "marge_je_moyenne_pct", label: "Marge JE par défaut (%)" },
]
const FOURCHETTE_FIELDS = [
  { key: "prix_jeh_min", label: "Prix JEH minimum (€)" },
  { key: "prix_jeh_max", label: "Prix JEH maximum (€)" },
]
// Clés financières gérées ici (pour ne lire/sauver QUE celles-ci).
const PRIX_KEYS = [...PRIX_FIELDS, ...FOURCHETTE_FIELDS].map((f) => f.key)

export default function PilotagePrix() {
  const [values, setValues] = useState<ParametresMap>({})
  const [marges, setMarges] = useState<MargesMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([getParametres(), getMargesRecommandees()]).then(([res, mres]) => {
      if (res.data) {
        const v: ParametresMap = {}
        for (const k of PRIX_KEYS) v[k] = res.data[k] ?? ""
        setValues(v)
      }
      if (mres.data) setMarges(mres.data)
      setLoading(false)
    })
  }, [])

  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }))
  const setMarge = (t: string, v: string) => setMarges((p) => ({ ...p, [t]: v === "" ? 0 : Number(v) }))

  const handleSave = async () => {
    setSaving(true)
    const [r, m] = await Promise.all([saveParametres(values), saveMargesRecommandees(marges)])
    setSaving(false)
    if (r.success && m.success) toast.success("Pilotage des prix enregistré", { position: "top-right" })
    else toast.error(r.error ?? m.error ?? "Erreur", { position: "top-right" })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-40"><Loader2 className="w-6 h-6 animate-spin text-[#00236f]" /></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-manrope font-bold text-[#00236f] text-lg">Pilotage des prix</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Prix moyens, fourchettes JEH et marges recommandées (utilisés par défaut dans les propositions).</p>
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card icon={Euro} title="Prix moyens">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            {PRIX_FIELDS.map((f) => <NumField key={f.key} field={f} value={values[f.key] ?? ""} onChange={(v) => set(f.key, v)} />)}
          </div>
        </Card>
        <Card icon={Gauge} title="Fourchettes de prix (JEH)">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            {FOURCHETTE_FIELDS.map((f) => <NumField key={f.key} field={f} value={values[f.key] ?? ""} onChange={(v) => set(f.key, v)} />)}
          </div>
        </Card>
        <Card icon={Gauge} title="Marges recommandées par taille d'entreprise" full>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-5">
            {TAILLES_ENTREPRISE.map((t) => (
              <div key={t}>
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wide capitalize">{t}</label>
                <div className="relative">
                  <input type="number" step="0.5" value={marges[t] ?? ""} onChange={(e) => setMarge(t, e.target.value)}
                    className="w-full h-10 px-3 pr-8 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20" />
                  <span className="absolute right-3 top-2.5 text-zinc-400 text-sm">%</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}

function Card({ icon: Icon, title, children, full }: { icon: any; title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden ${full ? "xl:col-span-2" : ""}`}>
      <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50 flex items-center gap-3">
        <Icon className="w-5 h-5 text-[#00236f]" />
        <h3 className="font-manrope font-bold text-[#00236f]">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function NumField({ field, value, onChange }: { field: { key: string; label: string; hint?: string }; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wide">{field.label}</label>
      <input type="number" step="0.01" value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20" />
      {field.hint && <p className="text-xs text-zinc-400 mt-1">{field.hint}</p>}
    </div>
  )
}
