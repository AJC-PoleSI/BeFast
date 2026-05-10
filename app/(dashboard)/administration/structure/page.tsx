"use client"

import { useEffect, useState } from "react"
import { getAllParametres, setParametres } from "@/lib/actions/etudes"
import { Loader2, Save, CheckCircle2, Plus, X, Settings2 } from "lucide-react"
import { toast } from "sonner"

type PolePerms = Record<string, boolean>
type PolePermsMap = Record<string, PolePerms>

const PERMISSION_CATALOG: { key: string; label: string }[] = [
  { key: "dashboard", label: "Accès au tableau de bord" },
  { key: "missions", label: "Accès au module Missions" },
  { key: "etudes", label: "Accès au module Études" },
  { key: "prospection", label: "Accès au module Prospection" },
  { key: "membres", label: "Accès au module Membres" },
  { key: "documents", label: "Accès au module Documents" },
  { key: "statistiques", label: "Accès aux Statistiques" },
  { key: "administration", label: "Accès complet Administration" },
  { key: "nouvelle_mission", label: "Créer une mission" },
  { key: "selectionner_candidats", label: "Sélectionner les candidats (RH)" },
  { key: "valider_comptes", label: "Valider les comptes membres" },
  { key: "voir_documents_membres", label: "Voir les documents des membres" },
  { key: "voir_factures", label: "Voir les factures" },
  { key: "valider_bv", label: "Valider les BV" },
  { key: "parametres_structure", label: "Paramètres structure" },
  { key: "gerer_parametres", label: "Gérer les paramètres" },
  { key: "publier_etudes", label: "Publier les études" },
  { key: "publier_missions", label: "Publier les missions" },
  { key: "assigner_intervenants", label: "Assigner les intervenants" },
]

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

function parsePoles(raw: string | undefined | null, keyExists: boolean): string[] {
  // If the key doesn't exist in DB yet (first time), use defaults
  if (!keyExists) return DEFAULT_POLES
  // If empty string or null, user has deleted all poles
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr.filter((v: any) => typeof v === "string")
  } catch {
    // fallback: comma-separated
    return raw.split(",").map(s => s.trim()).filter(Boolean)
  }
  return []
}

export default function ParametresStructurePage() {
  const [form, setForm] = useState<FormState>({})
  const [poles, setPoles] = useState<string[]>(DEFAULT_POLES)
  const [newPole, setNewPole] = useState("")
  const [polePerms, setPolePerms] = useState<PolePermsMap>({})
  const [editingPole, setEditingPole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    Promise.all([
      getAllParametres(),
      fetch("/api/poles").then(r => r.json()),
    ]).then(([formRes, polesRes]) => {
      if ("data" in formRes && formRes.data) {
        setForm(formRes.data)
      }
      // Load poles from the dedicated API (bypasses RLS)
      if (polesRes.data) {
        const pl = polesRes.data.poles_liste
        const pp = polesRes.data.pole_permissions
        if (Array.isArray(pl)) {
          setPoles(pl)
        } else {
          setPoles(DEFAULT_POLES)
        }
        if (pp && typeof pp === "object") {
          setPolePerms(pp)
        }
      }
      setLoading(false)
    })
  }, [])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    // Build payload from form fields ONLY — poles are managed separately via persistPoles
    const payload = { ...form }
    delete payload.poles_liste
    delete payload.pole_permissions

    const res = await setParametres(payload)
    if ("error" in res) {
      setSaving(false)
      toast.error((res as any).error)
      return
    }
    // Refetch from DB to confirm what was actually saved
    const fresh = await getAllParametres()
    if ("data" in fresh && fresh.data) {
      setForm(fresh.data)
    }
    setSaving(false)
    setSaved(true)
    toast.success("Paramètres enregistrés")
    setTimeout(() => setSaved(false), 2000)
  }

  function update(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  // Persist poles via dedicated API route (bypasses RLS, no revalidatePath)
  async function persistPoles(nextPoles: string[], nextPerms: PolePermsMap) {
    // Keep local form in sync
    setForm(prev => ({ ...prev, poles_liste: JSON.stringify(nextPoles), pole_permissions: JSON.stringify(nextPerms) }))
    try {
      const res = await fetch("/api/poles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ poles_liste: nextPoles, pole_permissions: nextPerms }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error("Erreur: " + (json.error || "Sauvegarde échouée"))
      } else {
        toast.success("Sous-pôle mis à jour")
      }
    } catch (err: any) {
      toast.error("Erreur réseau: " + err.message)
    }
  }

  function addPole() {
    const v = newPole.trim()
    if (!v) return
    if (poles.includes(v)) return
    setNewPole("")
    const nextPoles = [...poles, v]
    setPoles(nextPoles)
    persistPoles(nextPoles, polePerms)
  }

  function removePole(p: string) {
    if (editingPole === p) setEditingPole(null)
    const nextPoles = poles.filter(x => x !== p)
    const nextPerms = { ...polePerms }
    delete nextPerms[p]
    setPoles(nextPoles)
    setPolePerms(nextPerms)
    persistPoles(nextPoles, nextPerms)
  }

  function togglePolePerm(pole: string, key: string, value: boolean) {
    const nextPerms = {
      ...polePerms,
      [pole]: { ...(polePerms[pole] ?? {}), [key]: value },
    }
    setPolePerms(nextPerms)
    persistPoles(poles, nextPerms)
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
          <p className="text-zinc-500 text-sm mt-1">Informations utilisées dans les documents générés (factures, BV, missions).</p>
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
        <div key={section.title} className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50">
            <h2 className="font-manrope font-bold text-[#00236f]">{section.title}</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.fields.map((field: any) => (
              <div key={field.key} className={(field.key === "adresse_1" || field.key === "adresse_2") ? "md:col-span-2" : ""}>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">{field.label}</label>
                <div className="flex gap-2">
                  <input
                    type={field.type}
                    value={form[field.key] ?? ""}
                    onChange={e => update(field.key, e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                  {field.genreKey && (
                    <select
                      value={form[field.genreKey] ?? "F"}
                      onChange={e => update(field.genreKey, e.target.value)}
                      className="px-2 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
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
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50">
          <h2 className="font-manrope font-bold text-[#00236f]">Sous-pôles</h2>
          <p className="text-xs text-zinc-500 mt-0.5">Liste des sous-pôles disponibles dans le profil des membres (RH, Tréso, SI...).</p>
        </div>
        <div className="p-6 space-y-3">
          <div className="flex flex-wrap gap-2">
            {poles.length === 0 && (
              <span className="text-sm text-zinc-400 italic">Aucun sous-pôle configuré.</span>
            )}
            {poles.map(p => (
              <span
                key={p}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                  editingPole === p
                    ? "bg-[#00236f] text-white"
                    : "bg-[#d0d8ff] text-[#00236f]"
                }`}
              >
                {p}
                <button
                  type="button"
                  onClick={() => setEditingPole(editingPole === p ? null : p)}
                  className="hover:bg-white/20 rounded-full p-0.5"
                  aria-label={`Droits ${p}`}
                  title="Gérer les droits"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removePole(p)}
                  className="hover:bg-white/20 rounded-full p-0.5"
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
              className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
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
          <p className="text-xs text-emerald-500 font-medium">
            Les sous-pôles sont sauvegardés automatiquement.
          </p>

          {editingPole && (
            <div className="mt-4 rounded-lg border border-[#00236f]/20 bg-[#00236f]/[0.03] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[#00236f]">
                  Droits du pôle « {editingPole} »
                </h3>
                <button
                  type="button"
                  onClick={() => setEditingPole(null)}
                  className="text-zinc-400 hover:text-zinc-600"
                  aria-label="Fermer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-zinc-500 mb-3">
                Les droits cochés ici s'ajoutent aux droits du rôle du membre.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {PERMISSION_CATALOG.map(perm => {
                  const checked = !!polePerms[editingPole!]?.[perm.key]
                  return (
                    <label
                      key={perm.key}
                      className="flex items-center gap-2 px-3 py-2 rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 cursor-pointer text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e =>
                          togglePolePerm(editingPole!, perm.key, e.target.checked)
                        }
                        className="w-4 h-4 accent-[#00236f]"
                      />
                      <span className="text-zinc-700">{perm.label}</span>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
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
