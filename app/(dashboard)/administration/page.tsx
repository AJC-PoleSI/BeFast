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
  Receipt,
  Gauge,
  Info,
} from "lucide-react"
import { setParametres } from "@/lib/actions/etudes"
import { getParametres } from "@/lib/actions/parametres"
import { toast } from "sonner"
import {
  FOURCHETTE_JEH_DEFAUT,
  PARAMETRE_PLAFOND_JEH_CLIENT,
  PARAMETRE_PLAFOND_JEH_INTERVENANT,
  PARAMETRE_PRIX_MIN_JEH_CLIENT,
  PARAMETRE_RETRIBUTION_MIN_JEH,
} from "@/lib/missions/fourchette-jeh"
import {
  PARAMETRES_BV_2026,
  PARAMETRE_BV_ASSIETTE_DEPASSEMENT_PCT,
  PARAMETRE_BV_BASE_URSSAF,
} from "@/lib/bv/cotisations"

/* ──────────────────────────────────────────────────────────────────────────
 * Paramètres de la structure (identité, légal, bureau, financier…).
 * Stockés dans la table `parametres` via setParametres() (invalide le cache
 * PARAMETRES_TAG → les documents générés restent à jour).
 *
 * La fourchette du JEH (plafonds CNJE + minimum de rétribution) est éditée ici ;
 * la logique vit dans lib/missions/fourchette-jeh.ts.
 *
 * NB : le pilotage « Propositions & Prix » a été déplacé :
 *   - prix moyens / marges → Trésorerie ▸ onglet « Pilotage des prix »
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
  // Valeur affichée (et enregistrée) tant que la clé n'existe pas en base.
  defaut?: string
  // Explication dépliée par le bouton « i » (un paragraphe par entrée).
  aide?: string[]
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
      { key: "responsable_localite_nom", label: "Responsable Audit Qualité", type: "text", genreKey: "responsable_localite_genre" },
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
    title: "Fourchette du JEH",
    icon: Gauge,
    note: "Le JEH (jour-étude-homme) est l'unité de toutes les missions : le client paie des JEH, l'intervenant est rétribué en JEH, toujours en nombre entier. Le prix client d'un JEH doit rester dans la fourchette CNJE (80 à 500 € HT en 2026) et la rétribution sous le plafond URSSAF ; ces valeurs changent au fil des AGP. Cliquez sur le « i » d'un champ pour savoir comment le remplir.",
    fields: [
      {
        key: PARAMETRE_PRIX_MIN_JEH_CLIENT,
        label: "Prix minimum d'un JEH facturé au client (€ HT)",
        type: "number",
        defaut: String(FOURCHETTE_JEH_DEFAUT.prixMinClientHt),
        aide: [
          "Borne BASSE de la fourchette du JEH, fixée par la CNJE. Elle porte sur le prix payé par le CLIENT pour un JEH : hors taxes, marge de la Junior comprise, frais (déplacements, matériel) exclus.",
          "Dans Befast : BLOQUANT. Une mission dont le prix client par JEH est plus bas ne peut pas être enregistrée. Pour passer : augmenter la rétribution ou la marge de l'étude, ou mettre moins de JEH. Exemple : 60 € de rétribution sur 2 JEH avec 34 % de marge font 45,50 € HT par JEH, refusé.",
          "Où trouver la valeur : fourchette du JEH de la CNJE (Kiwi Légal). 80 € HT depuis 2021 ; l'AGP du 14 mars 2026 n'a relevé que le maximum.",
        ],
      },
      {
        key: PARAMETRE_PLAFOND_JEH_CLIENT,
        label: "Prix maximum d'un JEH facturé au client (€ HT)",
        type: "number",
        defaut: String(FOURCHETTE_JEH_DEFAUT.plafondClientHt),
        aide: [
          "Borne HAUTE de la fourchette du JEH, fixée par la CNJE. Elle porte sur le prix payé par le CLIENT pour un JEH : hors taxes, marge comprise, frais exclus.",
          "Dans Befast : fixe le nombre minimum de JEH proposé et affiche une alerte au-dessus. Exemple : une part de mission facturée 1 200 € HT demande au moins 3 JEH (1 200 / 500 = 2,4, arrondi au-dessus car un JEH ne se coupe pas).",
          "Où trouver la valeur : Kiwi Légal, rubrique Actu légale (comptes rendus d'AGP). 450 € HT jusqu'en mars 2026, 500 € HT depuis l'AGP du 14 mars 2026.",
        ],
      },
      {
        key: PARAMETRE_PLAFOND_JEH_INTERVENANT,
        label: "Rétribution maximum par JEH reversé à l'intervenant (€ brut)",
        type: "number",
        defaut: String(FOURCHETTE_JEH_DEFAUT.plafondIntervenantBrut),
        aide: [
          "Plafond MAXIMUM lié à l'URSSAF. Il porte sur ce que touche l'INTERVENANT pour un JEH, en brut (avant cotisations).",
          "À quoi il sert : en dessous, les cotisations se calculent sur une petite base forfaitaire (4 × SMIC horaire par JEH). Au-dessus, elles passent sur 70 % de la rétribution brute, bien plus cher, et l'URSSAF peut le contrôler.",
          "Dans Befast : fixe lui aussi le nombre minimum de JEH proposé et affiche une alerte au-dessus. Exemple : 900 € de rétribution demandent au moins 3 JEH (900 / 320 = 2,8, arrondi au-dessus).",
          "Où trouver la valeur : il suit le plafond journalier de la Sécurité sociale et peut changer chaque année (Kiwi Légal, Actu légale). 320 € brut en 2026.",
        ],
      },
      {
        key: PARAMETRE_RETRIBUTION_MIN_JEH,
        label: "Rétribution minimum par JEH (€ brut)",
        type: "number",
        defaut: String(FOURCHETTE_JEH_DEFAUT.retributionMinBrut),
        aide: [
          "Seuil MINIMUM fixé par la Junior elle-même (ce n'est pas une règle CNJE). Il porte sur ce que touche l'INTERVENANT pour un JEH, en brut.",
          "Dans Befast : BLOQUANT. Une mission dont la rétribution par JEH est plus basse ne peut pas être enregistrée. Une mission non rétribuée (0 €) reste possible. Mettre 0 désactive ce blocage.",
          "Valeur conseillée : au moins l'assiette forfaitaire URSSAF d'un JEH, 4 × SMIC horaire brut au 1er janvier (48,08 € en 2026). C'est la base sur laquelle les cotisations de chaque JEH sont calculées : rétribuer moins n'a pas de sens.",
        ],
      },
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
    title: "Mentions de facturation",
    icon: Receipt,
    note: "Textes imprimés sur les factures (PDF et modèle Word). Les conditions de règlement se surchargent facture par facture depuis la Trésorerie ; la valeur ci-dessous n'est que le défaut.",
    fields: [
      { key: "affiliation", label: "Mention d'affiliation", type: "text", full: true },
      { key: "conditions_reglement_defaut", label: "Conditions de règlement (défaut)", type: "text", full: true },
      { key: "mention_escompte", label: "Mention d'escompte", type: "text", full: true },
      { key: "regime_tva", label: "Régime de TVA", type: "text" },
      { key: "taux_penalites", label: "Taux des pénalités de retard", type: "text" },
      { key: "indemnite_recouvrement", label: "Indemnité de recouvrement", type: "text" },
    ],
  },
  {
    title: "Cotisations Bulletin de Versement",
    icon: Percent,
    note: "Taux au 1er janvier 2026 (URSSAF, référentiel CNJE) : à mettre à jour chaque 1er janvier, le BV de l'année les reprend automatiquement. Tous les taux, CSG/CRDS comprise, s'appliquent sur l'assiette de cotisation : forfaitaire (JEH × base URSSAF) ou, si la rétribution par JEH dépasse le plafond de la Fourchette du JEH, un pourcentage de la rétribution brute. Un taux à 0 laisse la ligne vide. Cliquez sur le « i » pour le détail.",
    fields: [
      {
        key: PARAMETRE_BV_BASE_URSSAF,
        label: "Base URSSAF forfaitaire par JEH (€)",
        type: "number",
        defaut: PARAMETRES_BV_2026[PARAMETRE_BV_BASE_URSSAF],
        aide: [
          "Assiette FORFAITAIRE d'un JEH : 4 × SMIC horaire brut au 1er janvier (4 × 12,02 € = 48,08 € en 2026). Le SMIC du 1er janvier reste valable toute l'année, même s'il est revalorisé en cours d'année.",
          "Dans le BV : assiette des cotisations = nombre de JEH × cette base, tant que la rétribution par JEH reste sous le plafond (Fourchette du JEH). Tous les taux ci-dessous s'appliquent à cette assiette.",
        ],
      },
      {
        key: PARAMETRE_BV_ASSIETTE_DEPASSEMENT_PCT,
        label: "Assiette au-delà du plafond par JEH (% de la rétribution brute)",
        type: "number",
        defaut: PARAMETRES_BV_2026[PARAMETRE_BV_ASSIETTE_DEPASSEMENT_PCT],
        aide: [
          "Règle URSSAF rappelée par la CNJE : si la rétribution brute par JEH dépasse le plafond (320 € en 2026, réglé dans « Fourchette du JEH »), les cotisations ne se calculent plus sur l'assiette forfaitaire mais sur ce pourcentage de la rétribution brute (70 %).",
          "Exemple : 400 € pour 1 JEH dépasse 320 € ⇒ assiette = 70 % × 400 € = 280 € au lieu de 48,08 €. Le BV l'indique dans la case « Base URSSAF ».",
        ],
      },
      { key: "_h_sante", label: "Santé", heading: true },
      { key: "bv_am_taux_junior", label: "Assurance maladie — part Junior (%)", type: "number", defaut: PARAMETRES_BV_2026.bv_am_taux_junior },
      {
        key: "bv_am_taux_etudiant",
        label: "Assurance maladie — part étudiant (%)",
        type: "number",
        defaut: PARAMETRES_BV_2026.bv_am_taux_etudiant,
        aide: ["0 % en général. Uniquement pour les Juniors d'Alsace-Moselle : 1,3 % (depuis le 01/04/2022)."],
      },
      {
        key: "bv_at_taux_junior",
        label: "Accident du travail — part Junior (%)",
        type: "number",
        defaut: PARAMETRES_BV_2026.bv_at_taux_junior,
        aide: [
          "Taux PROPRE à la Junior, notifié chaque année par la CARSAT : il n'y a pas de valeur nationale. À retrouver sur net-entreprises.fr ou dans l'espace URSSAF de la Junior (compte AT/MP).",
          "Tant qu'il est à 0, la ligne Accident du travail reste vide sur le BV.",
        ],
      },
      { key: "bv_at_taux_etudiant", label: "Accident du travail — part étudiant (%)", type: "number", defaut: PARAMETRES_BV_2026.bv_at_taux_etudiant },
      { key: "_h_retraite", label: "Retraite", heading: true },
      { key: "bv_avp_taux_junior", label: "Vieillesse plafonnée — part Junior (%)", type: "number", defaut: PARAMETRES_BV_2026.bv_avp_taux_junior },
      { key: "bv_avp_taux_etudiant", label: "Vieillesse plafonnée — part étudiant (%)", type: "number", defaut: PARAMETRES_BV_2026.bv_avp_taux_etudiant },
      { key: "bv_avd_taux_junior", label: "Vieillesse déplafonnée — part Junior (%)", type: "number", defaut: PARAMETRES_BV_2026.bv_avd_taux_junior },
      { key: "bv_avd_taux_etudiant", label: "Vieillesse déplafonnée — part étudiant (%)", type: "number", defaut: PARAMETRES_BV_2026.bv_avd_taux_etudiant },
      { key: "_h_famille", label: "Famille & autres contributions", heading: true },
      { key: "bv_af_taux_junior", label: "Allocations familiales — part Junior (%)", type: "number", defaut: PARAMETRES_BV_2026.bv_af_taux_junior },
      { key: "bv_af_taux_etudiant", label: "Allocations familiales — part étudiant (%)", type: "number", defaut: PARAMETRES_BV_2026.bv_af_taux_etudiant },
      {
        key: "bv_autre_taux_junior",
        label: "Autres contributions — part Junior (%)",
        type: "number",
        defaut: PARAMETRES_BV_2026.bv_autre_taux_junior,
        aide: [
          "0 % depuis le 1er janvier 2026 : le FNAL (0,10 %), la contribution solidarité autonomie (0,30 %) et la contribution au dialogue social (0,016 %) ont été supprimés pour les associations étudiantes à caractère pédagogique.",
        ],
      },
      { key: "bv_autre_taux_etudiant", label: "Autres contributions — part étudiant (%)", type: "number", defaut: PARAMETRES_BV_2026.bv_autre_taux_etudiant },
      { key: "_h_csg", label: "CSG / CRDS", heading: true },
      { key: "bv_csg_taux_junior", label: "CSG déductible — part Junior (%)", type: "number", defaut: PARAMETRES_BV_2026.bv_csg_taux_junior },
      { key: "bv_csg_taux_etudiant", label: "CSG déductible — part étudiant (%)", type: "number", defaut: PARAMETRES_BV_2026.bv_csg_taux_etudiant },
      { key: "bv_crdscsg_taux_junior", label: "CSG/CRDS non déductible — part Junior (%)", type: "number", defaut: PARAMETRES_BV_2026.bv_crdscsg_taux_junior },
      {
        key: "bv_crdscsg_taux_etudiant",
        label: "CSG/CRDS non déductible — part étudiant (%)",
        type: "number",
        defaut: PARAMETRES_BV_2026.bv_crdscsg_taux_etudiant,
        aide: ["CSG non déductible 2,40 % + CRDS 0,50 % = 2,90 %. Ce montant est réintégré dans le net imposable du BV."],
      },
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
            sForm[f.key] = all[f.key] ?? f.defaut ?? ""
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
  const [aideOuverte, setAideOuverte] = useState(false)
  return (
    <div className={field.full ? "md:col-span-2" : ""}>
      <div className="flex items-center gap-1.5 mb-1">
        <label className="block text-xs font-semibold text-zinc-600">{field.label}</label>
        {field.aide && (
          <button
            type="button"
            onClick={() => setAideOuverte((o) => !o)}
            aria-expanded={aideOuverte}
            aria-label={`Comment remplir : ${field.label}`}
            title="Comment remplir ce champ ?"
            className={`rounded-full p-0.5 transition-colors ${aideOuverte ? "text-[#00236f] bg-[#00236f]/10" : "text-zinc-400 hover:text-[#00236f]"}`}
          >
            <Info className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="flex gap-2">
        <input
          type={field.type ?? "text"}
          step={field.type === "number" ? "any" : undefined}
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
      {field.aide && aideOuverte && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-[#00236f]/15 bg-[#00236f]/[0.04] px-3 py-2.5 text-xs leading-relaxed text-zinc-700">
          {field.aide.map((paragraphe) => (
            <p key={paragraphe}>{paragraphe}</p>
          ))}
        </div>
      )}
    </div>
  )
}
