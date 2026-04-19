"use client"
import { useState, useEffect } from "react"
import { toast } from "sonner"

export default function ParametresStructurePage() {
  const [tva, setTva] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch("/api/admin/parametres").then(r => r.json()).then(d => {
      const tvaParam = d.parametres?.find((p: any) => p.key === "tva_rate")
      if (tvaParam) setTva(tvaParam.value)
    })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const res = await fetch("/api/admin/parametres", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "tva_rate", value: tva })
    })
    setSaving(false)
    if (res.ok) toast.success("TVA mise à jour")
    else toast.error("Erreur")
  }

  return (
    <div className="p-8 max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-manrope font-black text-[#00236f]">Paramètres de la structure</h1>
        <p className="text-slate-500 text-sm mt-1">Configurez les paramètres globaux de l&apos;application.</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h2 className="font-semibold text-slate-800">Fiscalité</h2>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Taux TVA (%)</label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={tva}
              onChange={e => setTva(e.target.value)}
              className="w-32 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              min="0" max="100" step="0.1"
            />
            <span className="text-sm text-slate-500">%</span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-sm font-semibold bg-[#00236f] text-white rounded-lg hover:bg-[#1e3a8a] transition-colors disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>
          {tva && (
            <p className="text-xs text-slate-400 mt-2">
              Exemple : 1000 € HT → {(1000 * (1 + Number(tva)/100)).toFixed(2)} € TTC
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
