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
  Percent,
} from "lucide-react"
import { setParametres } from "@/lib/actions/etudes"
import { getParametres } from "@/lib/actions/parametres"
import { toast } from "sonner"

/* ──────────────────────────────────────────────────────────────────────────
 * Paramètres de la structure (identité, légal, bureau, financier…).
 * Stockés dans la table `parametres` via setParametres() (invalide le cache
 * PARAMETRES_TAG → les documents générés restent à jour).
 *
 * NB : le pilotage « Propositions & Prix » a été déplacé :
 *   - prix moyens / fourchettes / marges → Trésorerie ▸ onglet « Pilotage des prix »
 *   - textes par défaut (contexte / CDC)  → Prospection ▸ Pilotage des phases
 * ────────────────────────────────────────────────────────────────────────── */

type FieldDef = {
  key: string
  label: string
  type?: string
  genreKey?: string
  full?: boolean
  // Sous-titre visuel (pas un champ) — key doit rester unique mais n'est ni
  // chargée ni sauvegardée.
  heading?: boolean
}
type SectionDef = { title: string; icon: any; note?: string; fields: FieldDef[] }

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
  {
    title: "Cotisations Bulletin de Versement",
    icon: Percent,
    note: "Taux officiels URSSAF à renseigner par le trésorier (mis à jour chaque année). Utilisés pour le calcul automatique du tableau de cotisations du Bulletin de Versement. Un taux à 0 laisse la ligne vide sur le document.",
    fields: [
      { key: "bv_base_urssaf", label: "Assiette forfaitaire par JEH (€)", type: "number" },
      { key: "bv_csg_assiette_pct", label: "Assiette CSG/CRDS (% de la rétribution brute)", type: "number" },
      { key: "_h_sante", label: "Santé", heading: true },
      { key: "bv_am_taux_junior", label: "Assurance maladie — part Junior (%)", type: "number" },
      { key: "bv_am_taux_etudiant", label: "Assurance maladie — part étudiant (%)", type: "number" },
      { key: "bv_at_taux_junior", label: "Accident du travail — part Junior (%)", type: "number" },
      { key: "bv_at_taux_etudiant", label: "Accident du travail — part étudiant (%)", type: "number" },
      { key: "_h_retraite", label: "Retraite", heading: true },
      { key: "bv_avp_taux_junior", label: "Vieillesse plafonnée — part Junior (%)", type: "number" },
      { key: "bv_avp_taux_etudiant", label: "Vieillesse plafonnée — part étudiant (%)", type: "number" },
      { key: "bv_avd_taux_junior", label: "Vieillesse déplafonnée — part Junior (%)", type: "number" },
      { key: "bv_avd_taux_etudiant", label: "Vieillesse déplafonnée — part étudiant (%)", type: "number" },
      { key: "_h_famille", label: "Famille & autres contributions", heading: true },
      { key: "bv_af_taux_junior", label: "Allocations familiales — part Junior (%)", type: "number" },
      { key: "bv_af_taux_etudiant", label: "Allocations familiales — part étudiant (%)", type: "number" },
      { key: "bv_autre_taux_junior", label: "Autres contributions — part Junior (%)", type: "number" },
      { key: "bv_autre_taux_etudiant", label: "Autres contributions — part étudiant (%)", type: "number" },
      { key: "_h_csg", label: "CSG / CRDS", heading: true },
      { key: "bv_csg_taux_junior", label: "CSG déductible — part Junior (%)", type: "number" },
      { key: "bv_csg_taux_etudiant", label: "CSG déductible — part étudiant (%)", type: "number" },
      { key: "bv_crdscsg_taux_junior", label: "CSG/CRDS non déductible — part Junior (%)", type: "number" },
      { key: "bv_crdscsg_taux_etudiant", label: "CSG/CRDS non déductible — part étudiant (%)", type: "number" },
    ],
  },
]

export default function ParametresAdminPage() {
  const [structureForm, setStructureForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getParametres().then((res) => {
      if (res.error) {
        setError(res.error)
      } else {
        const all = res.data ?? {}
        const sForm: Record<string, string> = {}
        for (const section of STRUCTURE_SECTIONS) {
          for (const f of section.fields) {
            if (f.heading) continue
            sForm[f.key] = all[f.key] ?? ""
            if (f.genreKey && all[f.genreKey] != null) sForm[f.genreKey] = all[f.genreKey]
          }
        }
        setStructureForm(sForm)
      }
      setLoading(false)
    })
  }, [])

  const updateStructure = (key: string, v: string) => setStructureForm((p) => ({ ...p, [key]: v }))

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const sRes = await setParametres(structureForm)
    setSaving(false)
    if ("success" in sRes && sRes.success) {
      setSaved(true)
      toast.success("Paramètres enregistrés", { position: "top-right" })
      setTimeout(() => setSaved(false), 2000)
    } else {
      toast.error(("error" in sRes ? sRes.error : undefined) ?? "Erreur lors de l'enregistrement", { position: "top-right" })
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
          <p className="text-xs font-mono mt-2 bg-amber-100 p-2 rounded">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Paramètres de la structure</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Identité, informations légales, bureau et coordonnées de la Junior-Entreprise.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-all shadow-sm disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? "Enregistré" : "Enregistrer"}
        </button>
      </div>

      <div className="max-w-5xl space-y-6 pb-8">
        {STRUCTURE_SECTIONS.map((section) => (
          <Card key={section.title} icon={section.icon} title={section.title}>
            {section.note && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                {section.note}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.fields.map((field) =>
                field.heading ? (
                  <p
                    key={field.key}
                    className="md:col-span-2 pt-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400 border-b border-zinc-100 pb-1"
                  >
                    {field.label}
                  </p>
                ) : (
                  <StructureField
                    key={field.key}
                    field={field}
                    value={structureForm[field.key] ?? ""}
                    genreValue={field.genreKey ? structureForm[field.genreKey] : undefined}
                    onChange={(v) => updateStructure(field.key, v)}
                    onGenreChange={(v) => field.genreKey && updateStructure(field.genreKey, v)}
                  />
                )
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}

function Card({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
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
