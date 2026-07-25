"use client"

import { useEffect, useMemo, useState } from "react"
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
  type FactureRow,
  type MissionPayRow,
  type CaParEtude,
} from "@/lib/actions/tresorerie"
import { getBudgetValidations, decideBudget, getProposalBudget, updateProposalModalites, type BudgetValidationRow, type ProposalBudgetDetail } from "@/lib/actions/propositions"
import { computeBudget, type PaiementModalites } from "@/lib/budget/compute"
import { BudgetSheet } from "@/components/budget/BudgetSheet"
import { listTemplates } from "@/lib/actions/documents"
import { useDocumentDownload } from "@/hooks/useDocumentDownload"

import PilotagePrix from "./PilotagePrix"

type Tab = "factures" | "ca" | "missions" | "notes" | "validation" | "pilotage"

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
    missions: MissionPayRow[]
    notes_de_frais: any[]
    caParEtude: CaParEtude[]
    kpis: any
    migrationMissing?: boolean
  } | null>(null)
  const [etudes, setEtudes] = useState<{ id: string; numero: string; nom: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [searchFacture, setSearchFacture] = useState("")
  const [searchMission, setSearchMission] = useState("")
  const [activeTab, setActiveTab] = useState<Tab>("factures")
  const [showModal, setShowModal] = useState(false)
  const [exportFrom, setExportFrom] = useState("")
  const [exportTo, setExportTo] = useState("")
  const [editingFacture, setEditingFacture] = useState<FactureRow | null>(null)
  const [showPayMission, setShowPayMission] = useState<MissionPayRow | null>(null)
  const [budgetRows, setBudgetRows] = useState<BudgetValidationRow[] | null>(null)
  const [rejectBudget, setRejectBudget] = useState<BudgetValidationRow | null>(null)
  const [budgetBusy, setBudgetBusy] = useState<string | null>(null)
  const [detailBudgetId, setDetailBudgetId] = useState<string | null>(null)
  const [factureTemplateId, setFactureTemplateId] = useState<string | null>(null)
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

  const missionsFiltrees = useMemo(() => {
    if (!data) return []
    const q = searchMission.toLowerCase().trim()
    if (!q) return data.missions
    return data.missions.filter((m) => {
      return (
        m.nom.toLowerCase().includes(q) ||
        (m.intervenant_nom ?? "").toLowerCase().includes(q) ||
        (m.numero_bv ?? "").toLowerCase().includes(q) ||
        (m.etude_numero ?? "").toLowerCase().includes(q) ||
        (m.etude_nom ?? "").toLowerCase().includes(q)
      )
    })
  }, [data, searchMission])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <Loader2 className="w-7 h-7 animate-spin text-[#00236f]" />
        <p className="text-sm text-zinc-400 font-medium animate-pulse">Chargement de la trésorerie…</p>
      </div>
    )
  }
  if (!data) {
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
            <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Missions à payer</p>
            <p className="text-lg font-manrope font-black text-[#00236f] tabular-nums">{kpis.nbMissionsAPayer}</p>
          </div>
        </div>
      </div>

      {/* Tab navigation (breadcrumb-style) */}
      <div className="flex items-center gap-1 text-sm border-b border-zinc-200">
        {[
          { key: "factures" as Tab, label: `Suivi des factures (${data.factures.length})` },
          { key: "ca" as Tab, label: "CA facturé" },
          { key: "missions" as Tab, label: `Suivi des missions (${data.missions.length})` },
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
                            {factureTemplateId && (
                              <button
                                onClick={() => generateDocument({ template_id: factureTemplateId, scope: "facture", entity_id: f.id })}
                                disabled={generatingDocument}
                                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-zinc-400 hover:text-[#00236f] hover:bg-[#d0d8ff] transition-all disabled:opacity-50"
                                title="Télécharger la facture"
                              >
                                <Download className="w-4 h-4" />
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

      {/* ─── Suivi des missions ───────────────────────────── */}
      {activeTab === "missions" && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="relative p-3 border-b border-zinc-100">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="search"
              placeholder="Rechercher une mission (nom, intervenant, BV, étude)…"
              value={searchMission}
              onChange={(e) => setSearchMission(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-lg bg-zinc-50 border border-zinc-100 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  <th className="px-4 py-3">Étude</th>
                  <th className="px-4 py-3">BV</th>
                  <th className="px-4 py-3">Mission</th>
                  <th className="px-4 py-3">Intervenant</th>
                  <th className="px-4 py-3">Dates</th>
                  <th className="px-4 py-3">Paiement</th>
                  <th className="px-4 py-3 text-right">Montant</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {missionsFiltrees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-zinc-400 text-sm">
                      {searchMission ? "Aucune mission correspondante." : "Aucune mission."}
                    </td>
                  </tr>
                ) : (
                  missionsFiltrees.map((m) => (
                    <tr key={m.id} className="group hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3">
                        {m.etude_id ? (
                          <Link href={`/etudes/${m.etude_id}`} className="text-[#00236f] hover:underline font-medium">
                            {m.etude_numero ?? "—"}
                          </Link>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600">
                        {m.numero_bv ? (
                          <span className="font-mono">{m.numero_bv}</span>
                        ) : (
                          <span className="text-xs text-zinc-400">Pas de BV émis</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-700">
                        <Link href={`/missions/${m.id}`} className="hover:underline">{m.nom}</Link>
                      </td>
                      <td className="px-4 py-3">
                        {m.intervenant_nom ? (
                          <span className="text-zinc-700">{m.intervenant_nom}</span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 text-xs font-medium border border-amber-200">
                            pas d&apos;intervenant
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 text-xs">
                        {m.date_debut || m.date_fin ? (
                          <>
                            du {fmtDate(m.date_debut)}
                            <br />
                            au {fmtDate(m.date_fin)}
                          </>
                        ) : (
                          <span className="text-red-500 font-medium">Dates mal renseignées</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {m.paye ? (
                          <span className="text-emerald-600 font-medium">{fmtDate(m.date_paiement)}</span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-red-50 text-red-700 text-xs font-medium border border-red-200">
                            non payé
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#00236f] tabular-nums">{fmtEUR(m.montant)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {!m.paye ? (
                            <button
                              onClick={() => setShowPayMission(m)}
                              className="px-2.5 py-1 rounded-md text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 transition-colors"
                            >
                              Marquer payé
                            </button>
                          ) : (
                            <button
                              onClick={async () => {
                                if (!confirm(`Annuler le paiement de "${m.nom}" ?`)) return
                                const res = await marquerMissionPaiement(m.id, null)
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
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors text-xs font-semibold"
                            onClick={() => alert("Génération Excel (remplacement des balises) : Cette fonctionnalité sera implémentée prochainement. Pour le moment les infos sont : " + JSON.stringify({ montant: note.montant_total, intervenant: note.intervenant?.prenom + " " + note.intervenant?.nom, mission: note.mission?.nom }))}
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
          onClose={() => { setShowModal(false); setEditingFacture(null) }}
          onSaved={() => { setShowModal(false); setEditingFacture(null); reload() }}
        />
      )}

      {/* ── Modale paiement mission ── */}
      {showPayMission && (
        <PayMissionModal
          mission={showPayMission}
          onClose={() => setShowPayMission(null)}
          onSaved={() => { setShowPayMission(null); reload() }}
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
  onClose,
  onSaved,
}: {
  facture: FactureRow | null
  etudes: { id: string; numero: string; nom: string }[]
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
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
                onChange={(e) => setForm((f) => ({ ...f, montant_ht: e.target.value }))}
                placeholder="Ex : 1500"
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              />
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
                onChange={(e) => setForm((f) => ({ ...f, etude_id: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              >
                <option value="">— Aucune —</option>
                {etudes.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.numero} · {e.nom}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-600 mb-1">Type de facture</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
              >
                <option value="">— Non précisé —</option>
                <option value="acompte">Acompte</option>
                <option value="intermediaire">Intermédiaire</option>
                <option value="solde">Solde</option>
              </select>
              <p className="text-xs text-zinc-400 mt-1">Utilisé pour la génération Word.</p>
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
                  onChange={(e) => setForm((f) => ({ ...f, accompte_pct: e.target.value }))}
                  placeholder="Ex : 30"
                  className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                />
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
/*  Pay mission modal                                          */
/* ────────────────────────────────────────────────────────── */
function PayMissionModal({
  mission,
  onClose,
  onSaved,
}: {
  mission: MissionPayRow
  onClose: () => void
  onSaved: () => void
}) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [numeroBv, setNumeroBv] = useState(mission.numero_bv ?? "")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
            const res = await marquerMissionPaiement(mission.id, date, numeroBv || null)
            setSubmitting(false)
            if ((res as any).error) { setError((res as any).error); return }
            onSaved()
          }}
          className="p-6 space-y-4"
        >
          <div className="p-3 rounded-lg bg-zinc-50 border border-zinc-100 text-xs space-y-1">
            <p><span className="text-zinc-500">Mission :</span> <span className="font-medium text-zinc-800">{mission.nom}</span></p>
            <p><span className="text-zinc-500">Intervenant :</span> <span className="font-medium text-zinc-800">{mission.intervenant_nom ?? "—"}</span></p>
            <p><span className="text-zinc-500">Montant :</span> <span className="font-bold text-[#00236f]">{fmtEUR(mission.montant)}</span></p>
          </div>
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
