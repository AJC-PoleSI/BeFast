"use client"

import { useEffect, useState } from "react"
import { getAllParametres, setParametres } from "@/lib/actions/etudes"
import { Loader2, Save, CheckCircle2, Plus, X } from "lucide-react"

const DEFAULT_POLES = [
  "Developpement",
  "Commercial",
  "Communication",
  "Tresorerie",
  "Presidence",
  "Secretariat",
  "Qualite",
  "RH",
  "SI",
]

type FormState = Record<string, string>

const SECTIONS = [
  {
    title: "Identité de la structure",
    fields: [
      { key: "raison_sociale", label: "Raison sociale", type: "text" },
      { key: "statuts_juridiques", label: "Statuts juridiques", type: "text" },
      { key: "tribunal", label: "Tribunal de commerce", type: "text" },
      { key: "passation", label: "Date de passation", type: "date" },
      { key: "nom_ecole", label: "Nom école/université", type: "text" },
    ],
  },
  {
    title: "Numérotation",
    fields: [
      { key: "numero_prochaine_facture", label: "Prochaine facture n°", type: "number" },
      { key: "numero_prochaine_mission", label: "Prochaine mission n°", type: "number" },
      { key: "numero_prochain_bv", label: "Prochain BV n°", type: "number" },
      { key: "numero_prochain_avenant", label: "Prochain avenant n°", type: "number" },
    ],
  },
  {
    title: "Bureau",
    fields: [
      { key: "president_nom", label: "Président(e)", type: "text", genreKey: "president_genre" },
      { key: "vice_president_nom", label: "Vice-président(e)", type: "text", genreKey: "vice_president_genre" },
      { key: "tresorier_nom", label: "Trésorier(e)", type: "text", genreKey: "tresorier_genre" },
      { key: "sg_nom", label: "Secrétaire général(e)", type: "text", genreKey: "sg_genre" },
      { key: "rh_nom", label: "Responsable RH", type: "text", genreKey: "rh_genre" },
      { key: "responsable_localite_nom", label: "Responsable localité", type: "text", genreKey: "responsable_localite_genre" },
      { key: "devco_nom", label: "Responsable DEVCO", type: "text", genreKey: "devco_genre" },
      { key: "si_nom", label: "Responsable SI", type: "text", genreKey: "si_genre" },
    ],
  },
  {
    title: "Financier",
    fields: [
      { key: "frais_structure", label: "Frais de structure (%)", type: "number" },
      { key: "remuneration_defaut", label: "Rémunération par JEH (€)", type: "number" },
      { key: "tva_rate", label: "Taux TVA (%)", type: "number" },
    ],
  },
  {
    title: "Coordonnées bancaires",
    fields: [
      { key: "rib", label: "RIB", type: "text" },
      { key: "domiciliation", label: "Domiciliation", type: "text" },
      { key: "iban", label: "IBAN", type: "text" },
      { key: "bic", label: "BIC", type: "text" },
      { key: "ordre_paiements", label: "Ordre de paiement (chèques)", type: "text" },
    ],
  },
  {
    title: "Adresse & contact",
    fields: [
      { key: "adresse_1", label: "Adresse ligne 1", type: "text" },
      { key: "adresse_2", label: "Adresse ligne 2", type: "text" },
      { key: "code_postal", label: "Code postal", type: "text" },
      { key: "ville", label: "Ville", type: "text" },
      { key: "telephone", label: "Téléphone", type: "text" },
      { key: "email_contact", label: "Email contact", type: "email" },
      { key: "site_web", label: "Site web", type: "url" },
    ],
  },
  {
    title: "Informations légales",
    fields: [
      { key: "siret", label: "SIRET", type: "text" },
      { key: "code_ape", label: "Code APE", type: "text" },
      { key: "numero_urssaf", label: "Numéro URSSAF", type: "text" },
      { key: "numero_tva", label: "Numéro TVA intracom.", type: "text" },
    ],
  },
] as const

function parsePoles(raw: string | undefined): string[] {
  if (!raw) return DEFAULT_POLES
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr) && arr.every(v => typeof v === "string")) return arr
  } catch {
    // fallback: comma-separated
    return raw.split(",").map(s => s.trim()).filter(Boolean)
  }
  return DEFAULT_POLES
}

export default function ParametresStructurePage() {
  const [form, setForm] = useState<FormState>({})
  const [poles, setPoles] = useState<string[]>(DEFAULT_POLES)
  const [newPole, setNewPole] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getAllParametres().then(res => {
      if ("data" in res && res.data) {
        setForm(res.data)
        setPoles(parsePoles(res.data.poles_liste))
      }
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const payload = { ...form, poles_liste: JSON.stringify(poles) }
    const res = await setParametres(payload)
    setSaving(false)
    if ("error" in res) { alert((res as any).error); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function update(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function addPole() {
    const v = newPole.trim()
    if (!v || poles.includes(v)) return
    setPoles(p => [...p, v])
    setNewPole("")
  }

  function removePole(p: string) {
    setPoles(list => list.filter(x => x !== p))
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-[#00236f]" />
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Paramètres de la structure</h1>
          <p className="text-slate-500 text-sm mt-1">Informations utilisées dans les documents générés (factures, BV, missions).</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#00236f] text-white rounded-lg hover:bg-[#1e3a8a] disabled:opacity-50 font-semibold text-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Enregistré" : "Enregistrer"}
        </button>
      </div>

      {SECTIONS.map(section => (
        <div key={section.title} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <h2 className="font-manrope font-bold text-[#00236f]">{section.title}</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.fields.map((field: any) => (
              <div key={field.key} className={(field.key === "adresse_1" || field.key === "adresse_2") ? "md:col-span-2" : ""}>
                <label className="block text-xs font-semibold text-slate-600 mb-1">{field.label}</label>
                <div className="flex gap-2">
                  <input
                    type={field.type}
                    value={form[field.key] ?? ""}
                    onChange={e => update(field.key, e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                  {field.genreKey && (
                    <select
                      value={form[field.genreKey] ?? "F"}
                      onChange={e => update(field.genreKey, e.target.value)}
                      className="px-2 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                    >
                      <option value="F">Mme</option>
                      <option value="M">M.</option>
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Gestion des sous-pôles */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
          <h2 className="font-manrope font-bold text-[#00236f]">Sous-pôles</h2>
          <p className="text-xs text-slate-500 mt-0.5">Liste des sous-pôles disponibles dans le profil des membres (RH, Tréso, SI...).</p>
        </div>
        <div className="p-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            {poles.length === 0 && (
              <span className="text-sm text-slate-400 italic">Aucun sous-pôle configuré.</span>
            )}
            {poles.map(p => (
              <span
                key={p}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#d0d8ff] text-[#00236f] text-sm font-medium"
              >
                {p}
                <button
                  type="button"
                  onClick={() => removePole(p)}
                  className="hover:bg-[#00236f]/10 rounded-full p-0.5"
                  aria-label={`Supprimer ${p}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newPole}
              onChange={e => setNewPole(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addPole() } }}
              placeholder="Nouveau sous-pôle (ex: Tréso)"
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
            />
            <button
              type="button"
              onClick={addPole}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-[#00236f] text-white rounded-lg hover:bg-[#1e3a8a]"
            >
              <Plus className="w-4 h-4" />
              Ajouter
            </button>
          </div>
          <p className="text-xs text-slate-400">
            N'oublie pas de cliquer sur « Enregistrer » en bas pour sauvegarder les changements.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[#00236f] text-white rounded-lg hover:bg-[#1e3a8a] disabled:opacity-50 font-semibold text-sm"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Enregistré" : "Enregistrer tous les paramètres"}
        </button>
      </div>
    </div>
  )
}
