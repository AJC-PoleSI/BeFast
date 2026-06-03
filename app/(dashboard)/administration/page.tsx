"use client"

import { useEffect, useState } from "react"
import {
  Save,
  Loader2,
  CheckCircle2,
  Building2,
  Hash,
  Users,
  Wallet,
  Landmark,
  MapPin,
  ScrollText,
  SlidersHorizontal,
  Euro,
  FileText,
  Gauge,
} from "lucide-react"
import { setParametres } from "@/lib/actions/etudes"
import {
  getParametres,
  saveParametres,
  getMargesRecommandees,
  saveMargesRecommandees,
} from "@/lib/actions/parametres"
import { TAILLES_ENTREPRISE, type ParametresMap, type MargesMap } from "@/lib/proposals-constants"
import { toast } from "sonner"

/* ──────────────────────────────────────────────────────────────────────────
 * Page unique de paramétrage de l'administration.
 *
 * Elle fusionne les 3 anciennes pages redondantes :
 *   - « Paramètres structure »   → onglet « Structure & Légal »
 *   - « Structure » (mockup mort) → supprimé
 *   - « Contrôle des données »    → onglet « Propositions & Prix »
 *
 * Choix d'architecture (important) :
 *   • Les champs « Structure » sont sauvegardés via setParametres() (lib/etudes)
 *     car cette action invalide le cache PARAMETRES_TAG → les documents générés
 *     (factures, BV, missions) restent à jour immédiatement.
 *   • Les champs « Propositions » + marges sont sauvegardés via les actions
 *     admin-only de lib/parametres (saveParametres / saveMargesRecommandees),
 *     exactement comme l'ancienne page « Contrôle des données ».
 *   • Les deux ensembles de clés sont DISJOINTS → aucun écrasement croisé.
 * ────────────────────────────────────────────────────────────────────────── */

type FieldDef = { key: string; label: string; type?: string; genreKey?: string; full?: boolean }
type SectionDef = { title: string; icon: any; fields: FieldDef[] }

/* ─── Onglet 1 : Structure & Légal ─────────────────────────────────────────── */
const STRUCTURE_SECTIONS: SectionDef[] = [
  {
    title: "Identité de la structure",
    icon: Building2,
    fields: [
      { key: "raison_sociale", label: "Raison sociale", type: "text", full: true },
      { key: "statuts_juridiques", label: "Statuts juridiques", type: "text" },
      { key: "tribunal", label: "Tribunal de commerce", type: "text" },
      { key: "passation", label: "Date de passation", type: "date" },
      { key: "nom_ecole", label: "Nom école/université", type: "text" },
    ],
  },
  {
    title: "Numérotation",
    icon: Hash,
    fields: [
      { key: "numero_prochaine_facture", label: "Prochaine facture n°", type: "number" },
      { key: "numero_prochaine_mission", label: "Prochaine mission n°", type: "number" },
      { key: "numero_prochain_bv", label: "Prochain BV n°", type: "number" },
      { key: "numero_prochain_avenant", label: "Prochain avenant n°", type: "number" },
    ],
  },
  {
    title: "Bureau",
    icon: Users,
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
    icon: Wallet,
    fields: [
      { key: "frais_structure", label: "Frais de structure (%)", type: "number" },
      { key: "remuneration_defaut", label: "Rémunération par JEH (€)", type: "number" },
      { key: "tva_rate", label: "Taux TVA (%)", type: "number" },
    ],
  },
  {
    title: "Coordonnées bancaires",
    icon: Landmark,
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
    icon: MapPin,
    fields: [
      { key: "adresse_1", label: "Adresse ligne 1", type: "text", full: true },
      { key: "adresse_2", label: "Adresse ligne 2", type: "text", full: true },
      { key: "code_postal", label: "Code postal", type: "text" },
      { key: "ville", label: "Ville", type: "text" },
      { key: "telephone", label: "Téléphone", type: "text" },
      { key: "email_contact", label: "Email contact", type: "email" },
      { key: "site_web", label: "Site web", type: "url" },
    ],
  },
  {
    title: "Informations légales",
    icon: ScrollText,
    fields: [
      { key: "siret", label: "SIRET", type: "text" },
      { key: "code_ape", label: "Code APE", type: "text" },
      { key: "numero_urssaf", label: "Numéro URSSAF", type: "text" },
      { key: "numero_tva", label: "Numéro TVA intracom.", type: "text" },
    ],
  },
]

/* ─── Onglet 2 : Propositions & Prix ───────────────────────────────────────── */
const PRIX_FIELDS: { key: string; label: string; hint?: string }[] = [
  { key: "prix_jeh_moyen", label: "Prix JEH moyen (€)", hint: "Valeur par défaut d'une JEH de phase" },
  { key: "prix_suivi_jeh_moyen", label: "Prix JEH suivi CDP (€)" },
  { key: "frais_dossier_moyen", label: "Frais de dossier (€)" },
  { key: "marge_je_moyenne_pct", label: "Marge JE par défaut (%)" },
]

const FOURCHETTE_FIELDS: { key: string; label: string; hint?: string }[] = [
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

// Clés gérées par l'onglet « Propositions » (disjointes des clés « Structure »).
const PROPOSITION_KEYS = [...PRIX_FIELDS, ...FOURCHETTE_FIELDS, ...CONTENU_FIELDS].map((f) => f.key)

type TabId = "structure" | "data"

export default function ParametresAdminPage() {
  const [tab, setTab] = useState<TabId>("structure")
  const [structureForm, setStructureForm] = useState<Record<string, string>>({})
  const [dataForm, setDataForm] = useState<ParametresMap>({})
  const [marges, setMarges] = useState<MargesMap>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([getParametres(), getMargesRecommandees()]).then(([res, mres]) => {
      if (res.error) {
        setError(res.error)
      } else {
        const all = res.data ?? {}
        // Onglet structure : on ne récupère que les clés de structure.
        const sForm: Record<string, string> = {}
        for (const section of STRUCTURE_SECTIONS) {
          for (const f of section.fields) {
            sForm[f.key] = all[f.key] ?? ""
            // On ne pré-remplit le genre que s'il existe déjà (évite d'écrire un
            // genre vide qui fausserait le rendu Monsieur/Madame des documents).
            if (f.genreKey && all[f.genreKey] != null) sForm[f.genreKey] = all[f.genreKey]
          }
        }
        setStructureForm(sForm)
        // Onglet propositions : uniquement les clés de propale.
        const dForm: ParametresMap = {}
        for (const k of PROPOSITION_KEYS) dForm[k] = all[k] ?? ""
        setDataForm(dForm)
      }
      if (mres.data) setMarges(mres.data)
      setLoading(false)
    })
  }, [])

  const updateStructure = (key: string, v: string) => setStructureForm((p) => ({ ...p, [key]: v }))
  const updateData = (key: string, v: string) => setDataForm((p) => ({ ...p, [key]: v }))
  const setMarge = (taille: string, v: string) =>
    setMarges((p) => ({ ...p, [taille]: v === "" ? 0 : Number(v) }))

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    // Structure → setParametres (invalide le cache documents)
    // Propositions + marges → actions admin-only (comme « Contrôle des données »)
    const [sRes, dRes, mRes] = await Promise.all([
      setParametres(structureForm),
      saveParametres(dataForm),
      saveMargesRecommandees(marges),
    ])
    setSaving(false)

    const sOk = "success" in sRes && sRes.success
    const ok = sOk && dRes.success && mRes.success
    if (ok) {
      setSaved(true)
      toast.success("Paramètres enregistrés", { position: "top-right" })
      setTimeout(() => setSaved(false), 2000)
    } else {
      const msg =
        ("error" in sRes ? sRes.error : undefined) ??
        dRes.error ??
        mRes.error ??
        "Erreur lors de l'enregistrement"
      toast.error(msg, { position: "top-right" })
    }
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
            Assure-toi que les migrations des paramètres et des marges ont bien été appliquées.
          </p>
          <p className="text-xs font-mono mt-2 bg-amber-100 p-2 rounded">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 h-full overflow-y-auto">
      {/* En-tête + action unique */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Paramètres</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Configurez votre structure, vos informations légales et les valeurs par défaut des propositions.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-all shadow-sm disabled:opacity-50"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saved ? "Enregistré" : "Enregistrer"}
        </button>
      </div>

      {/* Onglets */}
      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-100 mb-6">
        <TabButton active={tab === "structure"} onClick={() => setTab("structure")} icon={Building2} label="Structure & Légal" />
        <TabButton active={tab === "data"} onClick={() => setTab("data")} icon={SlidersHorizontal} label="Propositions & Prix" />
      </div>

      {/* Contenu — Onglet Structure */}
      {tab === "structure" && (
        <div className="max-w-5xl space-y-6 pb-8">
          {STRUCTURE_SECTIONS.map((section) => (
            <Card key={section.title} icon={section.icon} title={section.title}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {section.fields.map((field) => (
                  <StructureField
                    key={field.key}
                    field={field}
                    value={structureForm[field.key] ?? ""}
                    genreValue={field.genreKey ? structureForm[field.genreKey] : undefined}
                    onChange={(v) => updateStructure(field.key, v)}
                    onGenreChange={(v) => field.genreKey && updateStructure(field.genreKey, v)}
                  />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Contenu — Onglet Propositions */}
      {tab === "data" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-8">
          <Card icon={Euro} title="Prix moyens">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
              {PRIX_FIELDS.map((f) => (
                <NumField key={f.key} field={f} value={dataForm[f.key] ?? ""} onChange={(v) => updateData(f.key, v)} />
              ))}
            </div>
          </Card>

          <Card icon={Gauge} title="Fourchettes de prix (JEH)">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
              {FOURCHETTE_FIELDS.map((f) => (
                <NumField key={f.key} field={f} value={dataForm[f.key] ?? ""} onChange={(v) => updateData(f.key, v)} />
              ))}
            </div>
            <p className="text-xs text-zinc-400 mt-4">
              Ces bornes servent de garde-fou indicatif lors de la saisie du prix JEH dans une proposition.
            </p>
          </Card>

          <Card icon={Gauge} title="Marges recommandées par taille d'entreprise" full>
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
          </Card>

          <Card icon={FileText} title="Contenu par défaut des propositions" full>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
              {CONTENU_FIELDS.map((f) => (
                <div key={f.key}>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wide">{f.label}</label>
                  <textarea
                    value={dataForm[f.key] ?? ""}
                    onChange={(e) => updateData(f.key, e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 resize-none"
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

/* ─── Sous-composants (au niveau module → pas de remount au frappé) ────────── */

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
        active ? "bg-white text-[#00236f] shadow-sm" : "text-zinc-500 hover:text-zinc-700"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  )
}

function Card({ icon: Icon, title, children, full }: { icon: any; title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden ${full ? "xl:col-span-2" : ""}`}>
      <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50 flex items-center gap-3">
        <Icon className="w-5 h-5 text-[#00236f]" />
        <h2 className="font-manrope font-bold text-[#00236f]">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

function StructureField({
  field,
  value,
  genreValue,
  onChange,
  onGenreChange,
}: {
  field: FieldDef
  value: string
  genreValue?: string
  onChange: (v: string) => void
  onGenreChange: (v: string) => void
}) {
  return (
    <div className={field.full ? "md:col-span-2" : ""}>
      <label className="block text-xs font-semibold text-zinc-600 mb-1">{field.label}</label>
      <div className="flex gap-2">
        <input
          type={field.type ?? "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
        />
        {field.genreKey && (
          <select
            value={genreValue || "F"}
            onChange={(e) => onGenreChange(e.target.value)}
            className="px-2 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
          >
            <option value="F">Mme</option>
            <option value="M">M.</option>
          </select>
        )}
      </div>
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
