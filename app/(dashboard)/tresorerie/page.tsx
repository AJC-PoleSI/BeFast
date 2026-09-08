"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
import { Loader2, Plus, X, Pencil, Trash2, Check, Wallet, Clock, AlertTriangle, CircleCheck, Euro, Banknote, Search, Receipt, Download, FileText, CheckCircle } from "lucide-react"
import Link from "next/link"
import {
  getTresorerieData,
  getEtudesForFactureSelect,
  createFacture,
  updateFacture,
  deleteFacture,
  marquerFacturePaiement,
  marquerMissionPaiement,
  marquerRetributionPaiement,
  annulerRetributionPaiement,
  marquerMissionRetributionsPayees,
  getProchainNumeroBV,
  type FactureRow,
  type RetributionRow,
  type RetributionParPersonne,
  type CaParEtude,
} from "@/lib/actions/tresorerie"
import { round2 } from "@/lib/tresorerie/retributions"
import { getBudgetValidations, decideBudget, getProposalBudget, updateProposalModalites, type BudgetValidationRow, type ProposalBudgetDetail } from "@/lib/actions/propositions"
import { computeBudget, type PaiementModalites } from "@/lib/budget/compute"
import { BudgetSheet } from "@/components/budget/BudgetSheet"
import { listTemplates } from "@/lib/actions/documents"
import { useDocumentDownload } from "@/hooks/useDocumentDownload"

import PilotagePrix from "./PilotagePrix"

type Tab = "factures" | "ca" | "retributions" | "personnes" | "notes" | "validation" | "pilotage"

const BUDGET_STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  brouillon: { label: "Brouillon", cls: "bg-zinc-100 text-zinc-600" },
  en_attente_validation: { label: "À valider", cls: "bg-amber-100 text-amber-700" },
  valide: { label: "Validé", cls: "bg-emerald-100 text-emerald-700" },
  rejete: { label: "Rejeté", cls: "bg-red-100 text-red-700" },
}

const STATUT_FACTURE_CHIP: Record<FactureRow["statut"], { label: string; cls: string }> = {
  payee: { label: "Payée", cls: "bg-emerald-100 text-emerald-700" },
  en_retard: { label: "En retard", cls: "bg-red-100 text-red-700" },
  a_venir: { label: "À venir", cls: "bg-blue-100 text-blue-700" },
  brouillon: { label: "Brouillon", cls: "bg-zinc-100 text-zinc-600" },
}

function fmtEUR(n: number | null | undefined): string {
  const v = Number(n ?? 0)
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(v) + " €"
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return "—"
  const dt = new Date(d)
  if (Number.isNaN(dt.getTime())) return "—"
  return dt.toLocaleDateString("fr-FR")
}

export default function TresoreriePage() {
  const [data, setData] = useState<{
    factures: FactureRow[]
    retributions: RetributionRow[]
    retributionsParPersonne: RetributionParPersonne[]
    notes_de_frais: any[]
    caParEtude: CaParEtude[]
    kpis: any
    migrationMissing?: boolean
    retributionsIndisponibles?: boolean
  } | null>(null)
  const [etudes, setEtudes] = useState<{ id: string; numero: string; nom: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchFacture, setSearchFacture] = useState("")
  const [searchRetribution, setSearchRetribution] = useState("")
  const [activeTab, setActiveTab] = useState<Tab>("factures")
  const [showModal, setShowModal] = useState(false)
  const [exportFrom, setExportFrom] = useState("")
  const [exportTo, setExportTo] = useState("")
  const [editingFacture, setEditingFacture] = useState<FactureRow | null>(null)
  const [showPayRetribution, setShowPayRetribution] = useState<RetributionRow | null>(null)
  const [payingMission, setPayingMission] = useState<string | null>(null)
  const [budgetRows, setBudgetRows] = useState<BudgetValidationRow[] | null>(null)
  const [rejectBudget, setRejectBudget] = useState<BudgetValidationRow | null>(null)
  const [budgetBusy, setBudgetBusy] = useState<string | null>(null)
  const [detailBudgetId, setDetailBudgetId] = useState<string | null>(null)
  const [factureTemplateId, setFactureTemplateId] = useState<string | null>(null)
  const [facturePdfId, setFacturePdfId] = useState<string | null>(null)

  // Facture au format PDF : rendue par /api/factures/[id]/pdf à partir du même
  // contexte que le modèle Word — c'est le format envoyé au client.
  const telechargerFacturePdf = async (f: FactureRow) => {
    setFacturePdfId(f.id)
    try {
      const res = await fetch(`/api/factures/${f.id}/pdf`)
      if (!res.ok) {
        const detail = await res.json().catch(() => null)
        alert(detail?.error || "Impossible de générer la facture.")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `Facture ${f.numero}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setFacturePdfId(null)
    }
  }
  const { generate: generateDocument, generating: generatingDocument } = useDocumentDownload()

  const loadBudgets = async () => {
    const res = await getBudgetValidations()
    // En cas de "Non autorisé" (non-admin), on laisse budgetRows à null -> onglet masqué.
    if ((res as any).data) setBudgetRows((res as any).data)
  }

  const handleDecideBudget = async (id: string, decision: "valide" | "rejete", comment?: string) => {
    setBudgetBusy(id)
    const res = await decideBudget(id, decision, comment)
    setBudgetBusy(null)
    if ((res as any).error) { alert((res as any).error); return }
    await loadBudgets()
  }

  const handleNoteFraisAction = async (id: string, action: "valider" | "rejeter" | "payer") => {
    try {
      const res = await fetch("/api/tresorerie/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      })
      if (!res.ok) throw new Error("Erreur lors de l'action")
      reload()
    } catch (error: any) {
      alert(error.message)
    }
  }

  const reload = async () => {
    const [res, eres] = await Promise.all([
      getTresorerieData(),
      getEtudesForFactureSelect(),
    ])
    if ((res as any).data) {
      setData((res as any).data)
      setLoadError(null)
    } else if ((res as any).error) {
      setLoadError((res as any).error)
    }
    if ((eres as any).data) setEtudes((eres as any).data)
  }

  useEffect(() => {
    setLoading(true)
    reload().finally(() => setLoading(false))
    loadBudgets()
    listTemplates().then((res) => {
      const tpl = (res as any)?.data?.find((t: any) => t.category === "facture")
      if (tpl) setFactureTemplateId(tpl.id)
    })
  }, [])

  const facturesFiltrees = useMemo(() => {
    if (!data) return []
    const q = searchFacture.toLowerCase().trim()
    if (!q) return data.factures
    return data.factures.filter((f) => {
      return (
        f.numero.toLowerCase().includes(q) ||
        (f.nom ?? "").toLowerCase().includes(q) ||
        (f.etude_numero ?? "").toLowerCase().includes(q) ||
        (f.etude_nom ?? "").toLowerCase().includes(q)
      )
    })
  }, [data, searchFacture])

  const retributionsFiltrees = useMemo(() => {
    if (!data) return []
    const q = searchRetribution.toLowerCase().trim()
    if (!q) return data.retributions
    return data.retributions.filter((r) => {
      return (
        r.mission_nom.toLowerCase().includes(q) ||
        (r.intervenant_nom ?? "").toLowerCase().includes(q) ||
        (r.numero_bv ?? "").toLowerCase().includes(q) ||
        (r.etude_numero ?? "").toLowerCase().includes(q) ||
        (r.etude_nom ?? "").toLowerCase().includes(q)
      )
    })
  }, [data, searchRetribution])

  // Regroupement par mission, dans l'ordre d'arrivée des lignes (les
  // rétributions d'une même mission se suivent déjà côté serveur).
  // `restant` ignore volontairement :
  //  - la ligne d'alerte « intervenants non sélectionnés » (aucune personne à
  //    qui rattacher un versement individuel) ;
  //  - les lignes orphelines : `marquerMissionRetributionsPayees` construit sa
  //    liste à partir des intervenants ACTUELS de la mission, une personne
  //    retirée de la mission n'y figure donc jamais. La compter ferait
  //    apparaître un bouton « Tout marquer payé » qui ne paierait rien.
  // `nbIntervenants` ne compte que les personnes identifiées : la ligne
  // d'alerte représente `manquants` personnes, pas une.
  const groupesRetributions = useMemo(() => {
    const groupes: {
      mission_id: string
      mission_nom: string
      etude_id: string | null
      etude_numero: string | null
      total: number
      restant: number
      nbIntervenants: number
      rows: RetributionRow[]
    }[] = []
    const parMission = new Map<string, (typeof groupes)[number]>()
    for (const row of retributionsFiltrees) {
      let groupe = parMission.get(row.mission_id)
      if (!groupe) {
        groupe = {
          mission_id: row.mission_id,
          mission_nom: row.mission_nom,
          etude_id: row.etude_id,
          etude_numero: row.etude_numero,
          total: 0,
          restant: 0,
          nbIntervenants: 0,
          rows: [],
        }
        parMission.set(row.mission_id, groupe)
        groupes.push(groupe)
      }
      groupe.rows.push(row)
      groupe.total = round2(groupe.total + row.montant)
      if (row.personne_id) groupe.nbIntervenants += 1
      if (!row.paye && row.personne_id && !row.orphelin) {
        groupe.restant = round2(groupe.restant + row.montant)
      }
    }
    return groupes
  }, [retributionsFiltrees])

  // Une recherche active ne montre qu'un sous-ensemble des lignes d'une
  // mission : le paiement groupé, lui, porterait sur TOUS les intervenants
  // restants. On le masque tant qu'un filtre est en place.
  const rechercheRetributionActive = searchRetribution.trim().length > 0

  const payerToutesLesRetributions = async (missionId: string, missionNom: string) => {
    if (!confirm(`Marquer payés tous les intervenants restants de "${missionNom}" ?`)) return
    setPayingMission(missionId)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const res = await marquerMissionRetributionsPayees(missionId, today)
      if ((res as any).error) { alert((res as any).error); return }
      await reload()
    } finally {
      setPayingMission(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-[#00236f]" />
        <p className="text-sm text-zinc-400 font-medium animate-pulse">Chargement de la trésorerie…</p>
      </div>
    )
  }
  if (!data) {
    if (loadError === "Non autorisé") {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <h2 className="font-bold text-amber-900">Accès réservé</h2>
            <p className="text-sm text-amber-800 mt-1">
              La Trésorerie est réservée aux membres du Bureau et du Pôle Trésorerie. Contacte un administrateur si tu penses devoir y avoir accès.
            </p>
          </div>
        </div>
      )
    }
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <h2 className="font-bold text-amber-900">Migration SQL non appliquée</h2>
              <p className="text-sm text-amber-800">
                La table <code className="px-1.5 py-0.5 bg-amber-100 rounded text-xs font-mono">factures</code> et
                les colonnes <code className="px-1.5 py-0.5 bg-amber-100 rounded text-xs font-mono">date_paiement</code>/<code className="px-1.5 py-0.5 bg-amber-100 rounded text-xs font-mono">numero_bv</code> sur <code className="px-1.5 py-0.5 bg-amber-100 rounded text-xs font-mono">missions</code> n&apos;existent pas encore dans la base.
              </p>
              <p className="text-sm text-amber-800">
                Va sur le <a href="https://supabase.com/dashboard/project/rslztpjwrrjrvajkwcvo/sql" target="_blank" rel="noopener" className="underline font-medium">SQL Editor Supabase</a>, copie le contenu du fichier <code className="px-1.5 py-0.5 bg-amber-100 rounded text-xs font-mono">supabase/migrations/024_factures_tresorerie.sql</code> et exécute.
              </p>
              {loadError && (
                <p className="text-xs text-amber-700 font-mono bg-amber-100 p-2 rounded mt-2">{loadError}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const kpis = data.kpis
  const nbBudgetsAValider = budgetRows
    ? budgetRows.filter((b) => b.budget_status === "en_attente_validation").length
    : 0
  const kpiList = [
    { icon: Wallet, title: "CA Facturé", value: fmtEUR(kpis.totalFacture), cls: "bg-blue-50 text-blue-600 border-blue-200" },
    { icon: CircleCheck, title: "Encaissé", value: fmtEUR(kpis.totalEncaisse), cls: "bg-emerald-50 text-emerald-600 border-emerald-200" },
    { icon: Clock, title: "En attente", value: fmtEUR(kpis.totalEnAttente), cls: "bg-amber-50 text-amber-600 border-amber-200" },
    { icon: AlertTriangle, title: "En retard", value: fmtEUR(kpis.totalEnRetard), cls: "bg-red-50 text-red-600 border-red-200" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-1">
            Treasury Management
          </p>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Trésorerie</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Suivi des factures, paiements clients et rétribution des intervenants
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Export comptable : factures + BV sur une période */}
          <div className="flex items-center gap-2 bg-white border border-zinc-200 px-3 py-2 rounded-xl">
            <input
              type="date"
              value={exportFrom}
              onChange={(e) => setExportFrom(e.target.value)}
              className="text-xs border border-zinc-200 rounded-md px-2 py-1 text-zinc-600 bg-transparent"
              title="Début de période"
            />
            <span className="text-xs text-zinc-400">→</span>
            <input
              type="date"
              value={exportTo}
              onChange={(e) => setExportTo(e.target.value)}
              className="text-xs border border-zinc-200 rounded-md px-2 py-1 text-zinc-600 bg-transparent"
              title="Fin de période"
            />
            <button
              onClick={() => {
                const qs = new URLSearchParams({ format: "xlsx" })
                if (exportFrom) qs.set("from", exportFrom)
                if (exportTo) qs.set("to", exportTo)
                window.open(`/api/tresorerie/export?${qs.toString()}`, "_blank")
              }}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#00236f] hover:underline"
              title="Excel : 2 onglets (factures + bulletins de versement)"
            >
              <Download className="w-3.5 h-3.5" /> Export Excel
            </button>
          </div>
          {budgetRows && (
            <button
              onClick={() => setActiveTab("validation")}
              className="relative flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3 py-2 rounded-xl text-emerald-700 hover:bg-emerald-100 transition-colors"
            >
              <Euro className="w-5 h-5" />
              <span className="text-sm font-semibold">Budget</span>
              {nbBudgetsAValider > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm">
                  {nbBudgetsAValider}
                </span>
              )}
            </button>
          )}
          <button
            onClick={() => setActiveTab("notes")}
            className="relative flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3 py-2 rounded-xl text-indigo-700 hover:bg-indigo-100 transition-colors"
          >
            <Receipt className="w-5 h-5" />
            <span className="text-sm font-semibold">Notes de frais déposées</span>
            {kpis.nbNotesSoumises > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm">
                {kpis.nbNotesSoumises}
              </span>
            )}
          </button>
          <button
            onClick={() => { setEditingFacture(null); setShowModal(true) }}
            disabled={data.migrationMissing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Nouvelle facture
          </button>
        </div>
      </div>

      {data.migrationMissing && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800 space-y-1">
            <p className="font-semibold">Migration SQL partielle ou manquante.</p>
            <p>
              Applique <code className="px-1.5 py-0.5 bg-amber-100 rounded text-xs font-mono">supabase/migrations/024_factures_tresorerie.sql</code> dans le{" "}
              <a href="https://supabase.com/dashboard/project/rslztpjwrrjrvajkwcvo/sql" target="_blank" rel="noopener" className="underline font-medium">SQL Editor Supabase</a>{" "}
              pour activer la création de factures et le suivi des paiements intervenants.
            </p>
          </div>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiList.map((k) => {
          const Icon = k.icon
          return (
            <div key={k.title} className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-5 transition-all hover:shadow-md hover:-translate-y-0.5">
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${k.cls}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">{k.title}</p>
              </div>
              <p className="text-2xl font-manrope font-black text-[#00236f] tabular-nums">{k.value}</p>
            </div>
          )
        })}
      </div>

      {/* Secondary KPIs — intervenants */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-zinc-200/80 shadow-sm p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center">
            <Banknote className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Rétribution à verser</p>
            <p className="text-lg font-manrope font-black text-[#00236f] tabular-nums">{fmtEUR(kpis.totalRetributionDue)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200/80 shadow-sm p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center">
            <Check className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Rétribution versée</p>
            <p className="text-lg font-manrope font-black text-[#00236f] tabular-nums">{fmtEUR(kpis.totalRetributionVersee)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200/80 shadow-sm p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Rétributions à payer</p>
            <p className="text-lg font-manrope font-black text-[#00236f] tabular-nums">{kpis.nbRetributionsAPayer}</p>
          </div>
        </div>
      </div>

      {/* Tab navigation (breadcrumb-style) */}
      <div className="flex items-center gap-1 text-sm border-b border-zinc-200">
        {[
          { key: "factures" as Tab, label: `Suivi des factures (${data.factures.length})` },
          { key: "ca" as Tab, label: "CA facturé" },
          { key: "retributions" as Tab, label: `Suivi des rétributions (${data.retributions.length})` },
          { key: "personnes" as Tab, label: `Par intervenant (${data.retributionsParPersonne.length})` },
          { key: "notes" as Tab, label: `Notes de frais (${data.notes_de_frais.length})` },
          ...(budgetRows
            ? [{
                key: "validation" as Tab,
                label: `Validation de budget${
                  budgetRows.filter((b) => b.budget_status === "en_attente_validation").length
                    ? ` (${budgetRows.filter((b) => b.budget_status === "en_attente_validation").length})`
                    : ""
                }`,
              }]
            : []),
          { key: "pilotage" as Tab, label: "Pilotage des prix" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2.5 font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.key
                ? "text-[#00236f] border-[#00236f]"
                : "text-zinc-500 border-transparent hover:text-zinc-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Suivi des factures ────────────────────────────── */}
      {activeTab === "factures" && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="relative p-3 border-b border-zinc-100">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="search"
              placeholder="Rechercher une facture (numéro, étude, nom)…"
              value={searchFacture}
              onChange={(e) => setSearchFacture(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-lg bg-zinc-50 border border-zinc-100 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Étude</th>
                  <th className="px-4 py-3">N°</th>
                  <th className="px-4 py-3">Nom</th>
                  <th className="px-4 py-3">Émission</th>
                  <th className="px-4 py-3">Échéance</th>
                  <th className="px-4 py-3">Paiement</th>
                  <th className="px-4 py-3 text-right">Montant HT</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {facturesFiltrees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-zinc-400 text-sm">
                      {searchFacture ? "Aucune facture correspondante." : "Aucune facture pour l'instant. Crée la première avec le bouton ci-dessus."}
                    </td>
                  </tr>
                ) : (
                  facturesFiltrees.map((f) => {
                    const sc = STATUT_FACTURE_CHIP[f.statut]
                    return (
                      <tr key={f.id} className="group hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3">
                          {f.etude_id ? (
                            <Link href={`/etudes/${f.etude_id}`} className="text-[#00236f] hover:underline font-medium">
                              {f.etude_numero ?? "—"}
                              {f.etude_nom ? <span className="text-zinc-500 font-normal"> · {f.etude_nom}</span> : null}
                            </Link>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-700">{f.numero}</td>
                        <td className="px-4 py-3 text-zinc-700">{f.nom ?? "—"}</td>
                        <td className="px-4 py-3 text-zinc-600">{fmtDate(f.date_emission)}</td>
                        <td className="px-4 py-3 text-zinc-600">{fmtDate(f.date_echeance)}</td>
                        <td className="px-4 py-3">
                          {f.date_paiement ? (
                            <span className="text-emerald-600 font-medium">{fmtDate(f.date_paiement)}</span>
                          ) : f.jours_retard ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 text-red-700 text-xs font-bold">
                              <Clock className="w-3 h-3" />
                              {f.jours_retard}j
                            </span>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.cls}`}>{sc.label}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[#00236f] tabular-nums">{fmtEUR(f.montant_ht)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {!f.date_paiement && (
                              <button
                                onClick={async () => {
                                  const today = new Date().toISOString().slice(0, 10)
                                  const res = await marquerFacturePaiement(f.id, today)
                                  if ((res as any).error) { alert((res as any).error); return }
                                  reload()
                                }}
                                className="p-1.5 rounded-md text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all"
                                title="Marquer comme payée (aujourd'hui)"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => telechargerFacturePdf(f)}
                              disabled={facturePdfId === f.id}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-zinc-400 hover:text-[#00236f] hover:bg-[#d0d8ff] transition-all disabled:opacity-50"
                              title="Télécharger la facture (PDF)"
                            >
                              {facturePdfId === f.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Download className="w-4 h-4" />
                              )}
                            </button>
                            {factureTemplateId && (
                              <button
                                onClick={() => generateDocument({ template_id: factureTemplateId, scope: "facture", entity_id: f.id })}
                                disabled={generatingDocument}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-zinc-400 hover:text-[#00236f] hover:bg-[#d0d8ff] transition-all disabled:opacity-50"
                                title="Télécharger la facture au format Word (modifiable)"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => { setEditingFacture(f); setShowModal(true) }}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-zinc-400 hover:text-[#00236f] hover:bg-[#d0d8ff] transition-all"
                              title="Modifier"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async () => {
                                if (!confirm(`Supprimer la facture ${f.numero} ?`)) return
                                const res = await deleteFacture(f.id)
                                if ((res as any).error) { alert((res as any).error); return }
                                reload()
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── CA facturé par étude ───────────────────────────── */}
      {activeTab === "ca" && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100">
            <h2 className="font-manrope font-bold text-[#00236f] text-base">CA facturé par étude</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Total facturé, encaissé et budget pour chaque étude ayant au moins une facture.</p>
          </div>
          {data.caParEtude.length === 0 ? (
            <div className="px-5 py-10 text-center text-zinc-400 text-sm">
              Aucune facture rattachée à une étude pour l&apos;instant.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Étude</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Budget HT</th>
                    <th className="px-4 py-3 text-right">Facturé</th>
                    <th className="px-4 py-3 text-right">Encaissé</th>
                    <th className="px-4 py-3 text-right">% Encaissé</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {data.caParEtude.map((c) => {
                    const pct = c.facture > 0 ? Math.round((c.paye / c.facture) * 100) : 0
                    return (
                      <tr key={c.etude_id} className="hover:bg-zinc-50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/etudes/${c.etude_id}`} className="text-[#00236f] hover:underline font-medium">
                            {c.etude_numero ?? "—"}
                            {c.etude_nom ? <span className="text-zinc-500 font-normal"> · {c.etude_nom}</span> : null}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-zinc-600 uppercase text-xs">{c.type ?? "—"}</td>
                        <td className="px-4 py-3 text-right text-zinc-600 tabular-nums">{fmtEUR(c.budget)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-[#00236f] tabular-nums">{fmtEUR(c.facture)}</td>
                        <td className="px-4 py-3 text-right text-emerald-600 tabular-nums">{fmtEUR(c.paye)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-20 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                              <div
                                className="h-full bg-emerald-500"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-zinc-600 tabular-nums w-9 text-right">{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ─── Suivi des rétributions ───────────────────────── */}
      {activeTab === "retributions" && (
        <div className="space-y-4">
          {/* Migration 067 absente : le suivi reste lisible, seul
              l'enregistrement d'un versement individuel est impossible.
              Bannière distincte de `migrationMissing` (factures, migration 024). */}
          {data.retributionsIndisponibles && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 space-y-1">
                <p className="font-semibold">Enregistrement des versements individuels indisponible.</p>
                <p>
                  Applique <code className="px-1.5 py-0.5 bg-amber-100 rounded text-xs font-mono">supabase/migrations/067_retributions_intervenants.sql</code> dans le{" "}
                  <a href="https://supabase.com/dashboard/project/rslztpjwrrjrvajkwcvo/sql" target="_blank" rel="noopener" className="underline font-medium">SQL Editor Supabase</a>{" "}
                  pour pouvoir marquer une rétribution payée intervenant par intervenant. Le suivi ci-dessous reste consultable.
                </p>
              </div>
            </div>
          )}
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="relative p-3 border-b border-zinc-100">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="search"
                placeholder="Rechercher un intervenant, une mission, un BV, une étude…"
                value={searchRetribution}
                onChange={(e) => setSearchRetribution(e.target.value)}
                className="w-full h-10 pl-9 pr-4 rounded-lg bg-zinc-50 border border-zinc-100 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Intervenant</th>
                    <th className="px-4 py-3">N° BV</th>
                    <th className="px-4 py-3">Dates</th>
                    <th className="px-4 py-3">Paiement</th>
                    <th className="px-4 py-3 text-right">Montant</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {groupesRetributions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-zinc-400 text-sm">
                        {searchRetribution ? "Aucune rétribution correspondante." : "Aucune rétribution à suivre."}
                      </td>
                    </tr>
                  ) : (
                    groupesRetributions.map((g) => (
                      <Fragment key={g.mission_id}>
                        <tr className="bg-zinc-50/80">
                          <td colSpan={4} className="px-4 py-2.5">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              {g.etude_id ? (
                                <Link href={`/etudes/${g.etude_id}`} className="text-[#00236f] hover:underline font-semibold">
                                  {g.etude_numero ?? "—"}
                                </Link>
                              ) : (
                                <span className="text-zinc-400 font-semibold">—</span>
                              )}
                              <span className="text-zinc-300">·</span>
                              <Link href={`/missions/${g.mission_id}`} className="text-zinc-700 font-medium hover:underline">
                                {g.mission_nom}
                              </Link>
                              <span className="text-xs text-zinc-400">
                                {g.nbIntervenants} intervenant·e·s
                              </span>
                              {rechercheRetributionActive && (
                                <span className="text-xs text-zinc-400 italic">· vue filtrée</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-zinc-500 tabular-nums">{fmtEUR(g.total)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-end gap-1">
                              {g.restant > 0 && !rechercheRetributionActive && (
                                <button
                                  onClick={() => payerToutesLesRetributions(g.mission_id, g.mission_nom)}
                                  disabled={payingMission === g.mission_id || data.retributionsIndisponibles}
                                  title={
                                    data.retributionsIndisponibles
                                      ? "Migration 067 non appliquée : impossible d'enregistrer les versements par intervenant."
                                      : undefined
                                  }
                                  className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#00236f] bg-[#00236f]/5 border border-[#00236f]/20 hover:bg-[#00236f]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  {payingMission === g.mission_id ? "…" : "Tout marquer payé"}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {g.rows.map((r) => (
                          <tr key={r.key} className="group hover:bg-zinc-50 transition-colors">
                            <td className="px-4 py-3 pl-8">
                              {r.personne_id ? (
                                <span className="text-zinc-700">
                                  {r.intervenant_nom ?? "—"}
                                  {r.orphelin && (
                                    <span className="ml-2 inline-block px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-600 text-xs font-medium border border-zinc-200 align-middle">
                                      n&apos;est plus sur la mission
                                    </span>
                                  )}
                                </span>
                              ) : r.paiementMissionNonAttribue ? (
                                // Paiement historique conservé mais que personne ne peut
                                // revendiquer avec certitude (candidature révoquée puis
                                // remplacée depuis, ou intervenant jamais identifié) :
                                // mention discrète plutôt que la ligne d'alerte
                                // « intervenants non sélectionnés », qui ne s'applique pas ici.
                                <span className="inline-block px-2 py-0.5 rounded-md bg-zinc-50 text-amber-700 text-xs font-medium border border-amber-200/70">
                                  Paiement enregistré au niveau de la mission, sans intervenant identifié
                                </span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
                                  {r.manquants} intervenant·e·s non sélectionné·e·s
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-zinc-600">
                              {r.numero_bv ? (
                                <span className="font-mono">{r.numero_bv}</span>
                              ) : (
                                <span className="text-xs text-zinc-400">Pas de BV émis</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-zinc-600 text-xs">
                              {r.date_debut || r.date_fin ? (
                                <>
                                  du {fmtDate(r.date_debut)}
                                  <br />
                                  au {fmtDate(r.date_fin)}
                                </>
                              ) : (
                                <span className="text-red-500 font-medium">Dates mal renseignées</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {r.paye ? (
                                <span className="text-emerald-600 font-medium">{fmtDate(r.date_paiement)}</span>
                              ) : (
                                <span className="inline-block px-2 py-0.5 rounded-md bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                                  non payé
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-[#00236f] tabular-nums">{fmtEUR(r.montant)}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1">
                                {!r.personne_id && !r.paye && g.rows.some((x) => x.personne_id) ? (
                                  // Payer cette ligne écrirait `missions.date_paiement`, que le
                                  // suivi rattacherait ensuite à l'intervenant unique déjà
                                  // sélectionné : on marquerait donc la mauvaise personne payée.
                                  // Tant que la mission mélange identifiés et non identifiés, la
                                  // seule sortie propre est de compléter la sélection.
                                  <span className="text-xs text-zinc-400">
                                    À sélectionner sur la mission
                                  </span>
                                ) : !r.paye ? (
                                  // Sans la migration 067, seule l'écriture par
                                  // intervenant est impossible : la ligne d'alerte
                                  // (personne_id null) passe par `marquerMissionPaiement`,
                                  // qui écrit `missions` et fonctionne toujours.
                                  <button
                                    onClick={() => setShowPayRetribution(r)}
                                    disabled={!!r.personne_id && data.retributionsIndisponibles}
                                    title={
                                      r.personne_id && data.retributionsIndisponibles
                                        ? "Migration 067 non appliquée : impossible d'enregistrer un versement par intervenant."
                                        : undefined
                                    }
                                    className="px-2.5 py-1 rounded-md text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Marquer payé
                                  </button>
                                ) : (
                                  <button
                                    onClick={async () => {
                                      const cible = r.intervenant_nom ?? r.mission_nom
                                      if (!confirm(`Annuler le paiement de "${cible}" ?`)) return
                                      // Ligne d'alerte : aucune personne à qui rattacher
                                      // le versement, il vit au niveau mission.
                                      const res = r.personne_id
                                        ? await annulerRetributionPaiement(r.mission_id, r.personne_id)
                                        : await marquerMissionPaiement(r.mission_id, null)
                                      if ((res as any).error) { alert((res as any).error); return }
                                      reload()
                                    }}
                                    className="px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 transition-colors"
                                  >
                                    Annuler paiement
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── Rétributions par intervenant ──────────────────── */}
      {activeTab === "personnes" && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100">
            <h2 className="font-manrope font-bold text-[#00236f] text-base">Rétributions par intervenant</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Total dû et déjà versé pour chaque intervenant, toutes missions confondues. Clique sur un nom pour voir le détail de ses rétributions.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Intervenant</th>
                  <th className="px-4 py-3 text-right">Missions</th>
                  <th className="px-4 py-3 text-right">BV émis</th>
                  <th className="px-4 py-3 text-right">Reste à verser</th>
                  <th className="px-4 py-3 text-right">Déjà versé</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.retributionsParPersonne.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-zinc-400 text-sm">
                      Aucun intervenant sélectionné sur les missions en cours.
                    </td>
                  </tr>
                ) : (
                  data.retributionsParPersonne.map((p) => (
                    <tr
                      key={p.personne_id}
                      className="hover:bg-zinc-50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        {/* Vrai bouton plutôt qu'un `onClick` sur la ligne : la
                            navigation vers le détail doit rester atteignable au
                            clavier. */}
                        <button
                          type="button"
                          onClick={() => { setSearchRetribution(p.intervenant_nom); setActiveTab("retributions") }}
                          className="text-left text-zinc-700 font-medium hover:text-[#00236f] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00236f]/30 rounded"
                          title="Voir le détail des rétributions de cet intervenant"
                        >
                          {p.intervenant_nom}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-600 tabular-nums">{p.nbMissions}</td>
                      <td className="px-4 py-3 text-right text-zinc-600 tabular-nums">{p.nbBv}</td>
                      <td className="px-4 py-3 text-right font-semibold text-[#00236f] tabular-nums">{fmtEUR(p.totalDu)}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 tabular-nums">{fmtEUR(p.totalVerse)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Notes de frais ───────────────────────────── */}
      {activeTab === "notes" && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100 flex justify-between items-center">
            <div>
              <h2 className="font-manrope font-bold text-[#00236f] text-base">Notes de Frais</h2>
              <p className="text-xs text-zinc-500 mt-0.5">Validation et paiement des frais des intervenants.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Numéro</th>
                  <th className="px-4 py-3">Mission / Étude</th>
                  <th className="px-4 py-3">Intervenant</th>
                  <th className="px-4 py-3">Statut</th>
                  <th className="px-4 py-3">Montant</th>
                  <th className="px-4 py-3 text-right">Justificatifs</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {data.notes_de_frais.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-zinc-400 text-sm">
                      Aucune note de frais.
                    </td>
                  </tr>
                ) : (
                  data.notes_de_frais.map((note) => (
                    <tr key={note.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-zinc-700">{note.numero_note_de_frais}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#00236f]">{note.mission?.nom}</div>
                        <div className="text-xs text-zinc-500">{note.mission?.etudes?.numero}</div>
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        {note.intervenant?.prenom} {note.intervenant?.nom}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          note.statut === 'paye' ? 'bg-emerald-100 text-emerald-700' :
                          note.statut === 'valide' ? 'bg-blue-100 text-blue-700' :
                          note.statut === 'soumis' ? 'bg-amber-100 text-amber-700' :
                          'bg-zinc-100 text-zinc-600'
                        }`}>
                          {note.statut.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-[#00236f]">{fmtEUR(note.montant_total)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {note.fichiers_justificatifs?.map((url: string, i: number) => (
                            <a key={i} href={`/api/storage/download?key=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer" className="p-1 rounded-md bg-zinc-100 text-zinc-600 hover:text-blue-600" title={`Fichier ${i+1}`}>
                              <FileText className="w-4 h-4" />
                            </a>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-indigo-50 text-indigo-400 cursor-not-allowed transition-colors text-xs font-semibold opacity-60"
                            disabled
                            title="Génération Excel : bientôt disponible"
                          >
                            <Download className="w-3.5 h-3.5" /> Générer
                          </button>
                          
                          {note.statut === 'soumis' && (
                            <>
                              <button onClick={() => handleNoteFraisAction(note.id, 'valider')} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-xs font-semibold">
                                <CheckCircle className="w-3.5 h-3.5" /> Valider
                              </button>
                            </>
                          )}
                          {note.statut === 'valide' && (
                            <button onClick={() => handleNoteFraisAction(note.id, 'payer')} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-xs font-semibold">
                              <Banknote className="w-3.5 h-3.5" /> Marquer Payée
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Validation de budget (admin) ───────────────────── */}
      {activeTab === "validation" && budgetRows && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-zinc-100">
            <h2 className="font-manrope font-bold text-[#00236f] text-base">Validation de budget des propositions</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Tant qu'un budget n'est pas validé, la proposition ne peut pas être réalisée (passage en CE / signature bloqués).
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Propale</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Statut budget</th>
                  <th className="px-4 py-3 text-right">Total HT</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {budgetRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-zinc-400 text-sm">
                      Aucune proposition à valider.
                    </td>
                  </tr>
                ) : (
                  budgetRows.map((b) => {
                    const chip = BUDGET_STATUS_CHIP[b.budget_status] ?? BUDGET_STATUS_CHIP.brouillon
                    return (
                      <tr key={b.id} className="hover:bg-zinc-50 transition-colors align-top">
                        <td className="px-4 py-3 font-mono font-medium">
                          <button
                            onClick={() => setDetailBudgetId(b.id)}
                            className="text-[#00236f] hover:underline"
                          >
                            {b.id}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-zinc-700">{b.client_company ?? "—"}</td>
                        <td className="px-4 py-3 text-zinc-600">{b.study_type ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${chip.cls}`}>{chip.label}</span>
                          {b.budget_status === "rejete" && b.budget_comment && (
                            <p className="text-xs text-red-500 mt-1 max-w-[220px]">{b.budget_comment}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-[#00236f] tabular-nums">{fmtEUR(b.total_ht)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setDetailBudgetId(b.id)}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold text-[#00236f] bg-[#00236f]/5 border border-[#00236f]/20 hover:bg-[#00236f]/10 transition-colors"
                            >
                              Voir le budget
                            </button>
                            {b.budget_status !== "valide" && (
                              <button
                                onClick={() => handleDecideBudget(b.id, "valide")}
                                disabled={budgetBusy === b.id}
                                className="px-2.5 py-1 rounded-md text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors disabled:opacity-50"
                              >
                                Valider
                              </button>
                            )}
                            {b.budget_status !== "rejete" && (
                              <button
                                onClick={() => setRejectBudget(b)}
                                disabled={budgetBusy === b.id}
                                className="px-2.5 py-1 rounded-md text-xs font-semibold text-red-700 bg-red-50 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50"
                              >
                                Rejeter
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Pilotage des prix (déplacé depuis Administration) ─── */}
      {activeTab === "pilotage" && <PilotagePrix />}

      {/* ── Modale détail budget ── */}
      {detailBudgetId && (
        <BudgetDetailModal
          proposalId={detailBudgetId}
          busy={budgetBusy === detailBudgetId}
          onClose={() => setDetailBudgetId(null)}
          onValidate={async () => {
            await handleDecideBudget(detailBudgetId, "valide")
            setDetailBudgetId(null)
          }}
          onReject={() => {
            const row = budgetRows?.find((b) => b.id === detailBudgetId) ?? null
            setDetailBudgetId(null)
            if (row) setRejectBudget(row)
          }}
        />
      )}

      {/* ── Modale rejet de budget ── */}
      {rejectBudget && (
        <RejectBudgetModal
          row={rejectBudget}
          busy={budgetBusy === rejectBudget.id}
          onClose={() => setRejectBudget(null)}
          onConfirm={async (comment) => {
            await handleDecideBudget(rejectBudget.id, "rejete", comment)
            setRejectBudget(null)
          }}
        />
      )}

      {/* ── Modale facture ── */}
      {showModal && (
        <FactureModal
          facture={editingFacture}
          etudes={etudes}
          factures={data?.factures ?? []}
          onClose={() => { setShowModal(false); setEditingFacture(null) }}
          onSaved={() => { setShowModal(false); setEditingFacture(null); reload() }}
        />
      )}

      {/* ── Modale paiement d'une rétribution ── */}
      {showPayRetribution && (
        <PayRetributionModal
          row={showPayRetribution}
          onClose={() => setShowPayRetribution(null)}
          onSaved={() => { setShowPayRetribution(null); reload() }}
        />
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────── */
/*  Facture modal                                              */
/* ────────────────────────────────────────────────────────── */
function FactureModal({
  facture,
  etudes,
  factures,
  onClose,
  onSaved,
}: {
  facture: FactureRow | null
  etudes: { id: string; numero: string; nom: string; total_ht?: number }[]
  factures: FactureRow[]
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    numero: facture?.numero ?? "",
    nom: facture?.nom ?? "",
    etude_id: facture?.etude_id ?? "",
    montant_ht: facture?.montant_ht?.toString() ?? "",
    type: facture?.type ?? "",
    accompte_pct: facture?.accompte_pct?.toString() ?? "",
    date_emission: facture?.date_emission ?? "",
    date_echeance: facture?.date_echeance ?? "",
    date_paiement: facture?.date_paiement ?? "",
    notes: facture?.notes ?? "",
    conditions_reglement: facture?.conditions_reglement ?? "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Une fois le Montant HT tapé à la main (hors calcul via le %), il ne doit
  // plus jamais être écrasé silencieusement par un changement d'étude/type —
  // c'est ce qui a produit une facture avec accompte_pct=60 et montant_ht
  // resté à une valeur qui ne correspond pas à 60% de l'étude. Une facture
  // existante (édition) est considérée comme déjà "figée".
  const [montantTouched, setMontantTouched] = useState(!!facture)

  // Total HT de l'étude sélectionnée = assiette du % d'acompte.
  const totalEtude = etudes.find((e) => e.id === form.etude_id)?.total_ht ?? 0

  // Déjà facturé sur cette étude par les AUTRES factures (exclut la facture en
  // cours d'édition) : sert de base au solde restant à facturer.
  const dejaFacture = (etudeId: string) =>
    factures
      .filter((f) => f.etude_id === etudeId && f.id !== facture?.id)
      .reduce((sum, f) => sum + (Number(f.montant_ht) || 0), 0)

  const soldeEtude = (etudeId: string, total: number) =>
    Math.max(0, Math.round((total - dejaFacture(etudeId)) * 100) / 100)

  // Saisir un % remplit le montant, et saisir un montant recalcule le % :
  // le trésorier arbitre dans le sens qui l'arrange sans jamais sortir du
  // budget de l'étude.
  const setPct = (pct: string) => {
    setForm((f) => {
      const montant =
        totalEtude > 0 && pct !== ""
          ? (Math.round(totalEtude * (Number(pct) / 100) * 100) / 100).toString()
          : f.montant_ht
      return { ...f, accompte_pct: pct, montant_ht: montant }
    })
  }
  const setMontant = (montant: string) => {
    setMontantTouched(true)
    setForm((f) => {
      const pct =
        totalEtude > 0 && montant !== "" && f.type === "acompte"
          ? (Math.round((Number(montant) / totalEtude) * 10000) / 100).toString()
          : f.accompte_pct
      return { ...f, montant_ht: montant, accompte_pct: pct }
    })
  }

  // Sélectionner une étude pré-remplit le montant HT : le montant calculé
  // depuis le % d'acompte si le type "Acompte" est déjà choisi, sinon le
  // solde restant à facturer sur l'étude (cas normal d'une facture unique
  // ou d'un solde). Si le trésorier a déjà tapé un montant à la main, on ne
  // le touche plus — sauf si un % d'acompte est saisi, qui reste prioritaire
  // et doit se recalculer pour la nouvelle étude.
  const applyEtude = (etudeId: string) => {
    setForm((f) => {
      const total = etudes.find((e) => e.id === etudeId)?.total_ht ?? 0
      if (f.type === "acompte" && f.accompte_pct) {
        const montant = Math.round(total * (Number(f.accompte_pct) / 100) * 100) / 100
        return { ...f, etude_id: etudeId, montant_ht: total > 0 ? montant.toString() : f.montant_ht }
      }
      if (montantTouched) return { ...f, etude_id: etudeId }
      const montant = soldeEtude(etudeId, total)
      return { ...f, etude_id: etudeId, montant_ht: total > 0 ? montant.toString() : f.montant_ht }
    })
  }

  // Changer le type recalcule aussi le montant si une étude est déjà choisie :
  // repasser en "Acompte" applique le % déjà saisi, les autres types
  // proposent le solde restant — sauf si le montant a déjà été saisi à la
  // main, qu'on ne doit alors plus jamais écraser silencieusement.
  const applyType = (type: string) => {
    setForm((f) => {
      if (!f.etude_id || totalEtude <= 0) return { ...f, type }
      if (type === "acompte" && f.accompte_pct) {
        const montant = Math.round(totalEtude * (Number(f.accompte_pct) / 100) * 100) / 100
        return { ...f, type, montant_ht: montant.toString() }
      }
      if (montantTouched) return { ...f, type }
      const montant = soldeEtude(f.etude_id, totalEtude)
      return { ...f, type, montant_ht: montant.toString() }
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100">
          <h2 className="font-manrope font-bold text-[#00236f] text-lg">
            {facture ? "Modifier la facture" : "Nouvelle facture"}
          </h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setSubmitting(true)
            setError(null)
            const payload = {
              numero: form.numero,
              nom: form.nom || null,
              etude_id: form.etude_id || null,
              montant_ht: Number(form.montant_ht || 0),
              type: (form.type || null) as "acompte" | "intermediaire" | "solde" | null,
              accompte_pct: form.type === "acompte" && form.accompte_pct ? Number(form.accompte_pct) : null,
              date_emission: form.date_emission || null,
              date_echeance: form.date_echeance || null,
              date_paiement: form.date_paiement || null,
              notes: form.notes || null,
              conditions_reglement: form.conditions_reglement || null,
            }
            const res = facture
              ? await updateFacture(facture.id, payload as any)
              : await createFacture(payload)
            setSubmitting(false)
            if ((res as any).error) { setError((res as any).error); return }
            onSaved()
          }}
          className="p-6 space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Numéro *</label>
              <input
                required
                value={form.numero}
                onChange={(e) => setForm((f) => ({ ...f, numero: e.target.value }))}
                placeholder="Ex : 26030"
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Montant HT (€) *</label>
              <input
                required
                type="number"
                step="0.01"
                value={form.montant_ht}
                onChange={(e) => setMontant(e.target.value)}
                placeholder="Ex : 1500"
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              />
              {totalEtude > 0 && (
                <p className="text-xs text-zinc-400 mt-1">
                  Total HT de l&apos;étude : {fmtEUR(totalEtude)}
                </p>
              )}
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Nom de la facturation</label>
              <input
                value={form.nom}
                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                placeholder="Ex : Facture d'acompte"
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Étude</label>
              <select
                value={form.etude_id}
                onChange={(e) => applyEtude(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              >
                <option value="">— Aucune —</option>
                {etudes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.numero} · {e.nom}
                  </option>
                ))}
              </select>
              {totalEtude > 0 && (
                <p className="text-xs text-zinc-400 mt-1">
                  Déjà facturé : {fmtEUR(dejaFacture(form.etude_id))} · Solde restant :{" "}
                  {fmtEUR(soldeEtude(form.etude_id, totalEtude))}
                </p>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Type de facture</label>
              <select
                value={form.type}
                onChange={(e) => applyType(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              >
                <option value="">— Non précisé —</option>
                <option value="acompte">Acompte</option>
                <option value="intermediaire">Intermédiaire</option>
                <option value="solde">Solde</option>
              </select>
              <p className="text-xs text-zinc-400 mt-1">Pilote les libellés et le bloc de totaux.</p>
            </div>
            {form.type === "acompte" ? (
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">% d&apos;acompte</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.accompte_pct}
                  onChange={(e) => setPct(e.target.value)}
                  placeholder="Ex : 60"
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                />
                {totalEtude > 0 && (
                  <p className="text-xs text-zinc-400 mt-1">
                    Solde restant : {fmtEUR(Math.max(0, totalEtude - Number(form.montant_ht || 0)))}
                  </p>
                )}
              </div>
            ) : (
              <div />
            )}
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Date d&apos;émission</label>
              <input
                type="date"
                value={form.date_emission ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, date_emission: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Date d&apos;échéance</label>
              <input
                type="date"
                value={form.date_echeance ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, date_echeance: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Date de paiement</label>
              <input
                type="date"
                value={form.date_paiement ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, date_paiement: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              />
              <p className="text-xs text-zinc-400 mt-1">Laisser vide si pas encore payée.</p>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Conditions de règlement</label>
              <input
                value={form.conditions_reglement ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, conditions_reglement: e.target.value }))}
                placeholder="A réception de facture"
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              />
              <p className="text-xs text-zinc-400 mt-1">
                Imprimé sur la facture. Vide = valeur par défaut des paramètres.
              </p>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Notes</label>
              <textarea
                value={form.notes ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 resize-none"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg">
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#00236f] text-white rounded-lg hover:bg-[#1e3a8a] disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {facture ? "Enregistrer" : "Créer la facture"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────── */
/*  Reject budget modal                                        */
/* ────────────────────────────────────────────────────────── */
function RejectBudgetModal({
  row,
  busy,
  onClose,
  onConfirm,
}: {
  row: BudgetValidationRow
  busy: boolean
  onClose: () => void
  onConfirm: (comment: string) => void
}) {
  const [comment, setComment] = useState(row.budget_comment ?? "")
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100">
          <h2 className="font-manrope font-bold text-red-600 text-lg">Rejeter le budget</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-zinc-600">
            Proposition <span className="font-mono font-semibold text-zinc-800">{row.id}</span>
            {row.client_company ? <> — {row.client_company}</> : null}.
          </p>
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1">Motif du rejet (optionnel)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Expliquez ce qui doit être corrigé dans le budget…"
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 resize-none"
            />
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg">Annuler</button>
            <button
              onClick={() => onConfirm(comment)}
              disabled={busy}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmer le rejet
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────── */
/*  Pay retribution modal                                      */
/* ────────────────────────────────────────────────────────── */
function PayRetributionModal({
  row,
  onClose,
  onSaved,
}: {
  row: RetributionRow
  onClose: () => void
  onSaved: () => void
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [numeroBv, setNumeroBv] = useState(row.numero_bv ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Un bulletin déjà émis garde son numéro ; sinon on propose le suivant de
  // l'année. La proposition n'écrase jamais une saisie du trésorier.
  useEffect(() => {
    if (row.numero_bv) return
    let actif = true
    getProchainNumeroBV()
      .then((res) => {
        if (!actif) return
        const propose = (res as any).data
        if (propose) setNumeroBv((actuel) => actuel || propose)
      })
      // Simple confort de saisie : si la proposition échoue, on laisse le champ
      // vide plutôt que de faire remonter un rejet non traité.
      .catch(() => {})
    return () => {
      actif = false
    }
  }, [row.numero_bv])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100">
          <h2 className="font-manrope font-bold text-[#00236f] text-lg">Paiement intervenant</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            setSubmitting(true)
            setError(null)
            // Côté serveur, clé `numero_bv` absente = numéro conservé. On ne
            // l'envoie donc que si un numéro est saisi, ou si la ligne n'en
            // portait aucun (rien à effacer) : vider le champ sur un bulletin
            // déjà émis ne doit pas supprimer sa trace.
            const bvSaisi = numeroBv.trim()
            const bvAEnvoyer = bvSaisi || (row.numero_bv ? undefined : null)
            // Ligne d'alerte : aucune personne identifiée, le versement ne peut
            // être enregistré qu'au niveau de la mission.
            const res = row.personne_id
              ? await marquerRetributionPaiement({
                  mission_id: row.mission_id,
                  personne_id: row.personne_id,
                  date_paiement: date,
                  montant: row.montant,
                  ...(bvAEnvoyer !== undefined ? { numero_bv: bvAEnvoyer } : {}),
                })
              : await marquerMissionPaiement(row.mission_id, date, bvAEnvoyer)
            setSubmitting(false)
            if ((res as any).error) { setError((res as any).error); return }
            onSaved()
          }}
          className="p-6 space-y-4"
        >
          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-100 text-xs space-y-1">
            <p><span className="text-zinc-500">Mission :</span> <span className="font-medium text-zinc-800">{row.mission_nom}</span></p>
            <p>
              <span className="text-zinc-500">Intervenant :</span>{" "}
              <span className="font-medium text-zinc-800">
                {row.personne_id
                  ? row.intervenant_nom ?? "—"
                  : `${row.manquants} intervenant·e·s non sélectionné·e·s`}
              </span>
            </p>
            <p><span className="text-zinc-500">Montant :</span> <span className="font-bold text-[#00236f]">{fmtEUR(row.montant)}</span></p>
          </div>
          {!row.personne_id && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              Aucun intervenant n&apos;est sélectionné sur cette mission : le paiement sera
              enregistré au niveau de la mission, sans détail par personne. Sélectionne les
              intervenants sur la mission pour un suivi individuel.
            </div>
          )}
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1">Date de paiement *</label>
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-zinc-600 mb-1">N° BV (optionnel)</label>
            <input
              value={numeroBv}
              onChange={(e) => setNumeroBv(e.target.value)}
              placeholder="Ex : BV-2026-001"
              className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
            />
            {row.numero_bv && (
              <p className="text-[11px] text-zinc-400 mt-1">
                Un bulletin est déjà émis sous le numéro {row.numero_bv} : vider ce champ ne
                l&apos;effacera pas.
              </p>
            )}
          </div>
          {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg">
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmer le paiement
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────── */
/*  Budget detail modal (Excel-style)                          */
/* ────────────────────────────────────────────────────────── */
function BudgetDetailModal({
  proposalId,
  busy,
  onClose,
  onValidate,
  onReject,
}: {
  proposalId: string
  busy: boolean
  onClose: () => void
  onValidate: () => void
  onReject: () => void
}) {
  const [detail, setDetail] = useState<ProposalBudgetDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [modalites, setModalites] = useState<PaiementModalites | null>(null)
  const [savingMod, setSavingMod] = useState(false)

  useEffect(() => {
    let active = true
    getProposalBudget(proposalId).then((res) => {
      if (!active) return
      if ((res as any).error) {
        setError((res as any).error)
        return
      }
      const d = (res as any).data as ProposalBudgetDetail
      setDetail(d)
      // Initialise l'éditeur de modalités : valeurs stockées sinon valeurs par défaut.
      if (d.modalites) {
        setModalites(d.modalites)
      } else {
        const b = computeBudget(d.budget)
        setModalites({
          type: b.paiementType,
          versements: b.versements.map((v) => ({ label: v.label, pct: v.pct })),
        })
      }
    })
    return () => {
      active = false
    }
  }, [proposalId])

  const breakdown = detail
    ? computeBudget({ ...detail.budget, paiementModalites: modalites })
    : null

  const pctSum = (modalites?.versements || []).reduce((s, v) => s + Number(v.pct || 0), 0)

  const setVersement = (i: number, patch: Partial<{ label: string; pct: number }>) => {
    setModalites((prev) => {
      if (!prev) return prev
      const versements = prev.versements.map((v, idx) => (idx === i ? { ...v, ...patch } : v))
      return { ...prev, versements }
    })
  }
  const addVersement = () =>
    setModalites((prev) =>
      prev ? { ...prev, versements: [...prev.versements, { label: "Versement", pct: 0 }] } : prev
    )
  const removeVersementAt = (i: number) =>
    setModalites((prev) =>
      prev && prev.versements.length > 1
        ? { ...prev, versements: prev.versements.filter((_, idx) => idx !== i) }
        : prev
    )

  // Persiste les modalités puis lance l'action passée par le parent (valider).
  const saveThen = async (next: () => void) => {
    if (modalites) {
      setSavingMod(true)
      await updateProposalModalites(proposalId, modalites)
      setSavingMod(false)
    }
    next()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0">
          <div>
            <h2 className="font-manrope font-bold text-[#00236f] text-lg">Budget de la proposition</h2>
            <p className="text-xs text-zinc-500 mt-0.5 font-mono">{proposalId}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {error ? (
            <p className="text-sm text-red-500 font-medium">{error}</p>
          ) : !breakdown || !detail ? (
            <div className="flex items-center justify-center py-12 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <>
              <BudgetSheet
                breakdown={breakdown}
                meta={{
                  id: detail.id,
                  client_company: detail.client_company,
                  study_type: detail.study_type,
                  cdp_name: detail.cdp_name,
                }}
              />

              {/* Éditeur des modalités de règlement (trésorerie) */}
              {modalites && (
                <div className="mt-6 border border-emerald-200 bg-emerald-50/40 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-emerald-900">
                      Modifier les modalités de règlement
                    </p>
                    <span
                      className={`text-xs font-bold ${
                        pctSum === 100 ? "text-emerald-700" : "text-red-600"
                      }`}
                    >
                      Total : {pctSum} %{pctSum !== 100 && " (doit faire 100 %)"}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {modalites.versements.map((v, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input
                          value={v.label}
                          onChange={(e) => setVersement(i, { label: e.target.value })}
                          className="flex-1 px-3 py-1.5 rounded border border-emerald-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={v.pct}
                          onChange={(e) => setVersement(i, { pct: Number(e.target.value) })}
                          className="w-[72px] px-2 py-1.5 rounded border border-emerald-200 text-sm text-right tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        />
                        <span className="text-xs text-emerald-700 w-4">%</span>
                        <span className="w-[110px] text-right text-sm font-bold text-emerald-900 tabular-nums">
                          {(breakdown.versements[i]?.montant ?? 0).toLocaleString("fr-FR")} €
                        </span>
                        <button
                          onClick={() => removeVersementAt(i)}
                          disabled={modalites.versements.length <= 1}
                          className="p-1 text-red-500 hover:text-red-700 disabled:opacity-30"
                          title="Supprimer"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addVersement}
                    className="mt-2 text-xs font-bold text-emerald-700 hover:text-emerald-900"
                  >
                    + Ajouter un versement
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-zinc-100 shrink-0">
          <a
            href={`/api/proposals/${encodeURIComponent(proposalId)}/budget-xlsx`}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <Download className="w-4 h-4" />
            Télécharger Excel
          </a>
          <div className="flex items-center gap-3">
            {detail && modalites && (
              <button
                onClick={() => saveThen(() => {})}
                disabled={busy || savingMod || pctSum !== 100}
                title={pctSum !== 100 ? "La somme des versements doit faire 100 %" : undefined}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-zinc-700 bg-zinc-100 border border-zinc-200 rounded-lg hover:bg-zinc-200 disabled:opacity-50"
              >
                {savingMod && <Loader2 className="h-4 w-4 animate-spin" />}
                Enregistrer les modalités
              </button>
            )}
            {detail && detail.budget_status !== "rejete" && (
              <button
                onClick={onReject}
                disabled={busy}
                className="px-4 py-2 text-sm font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50"
              >
                Rejeter
              </button>
            )}
            {detail && detail.budget_status !== "valide" && (
              <button
                onClick={() => saveThen(onValidate)}
                disabled={busy || savingMod || pctSum !== 100}
                title={pctSum !== 100 ? "La somme des versements doit faire 100 %" : undefined}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {(busy || savingMod) && <Loader2 className="h-4 w-4 animate-spin" />}
                Valider le budget
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
