"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Plus, X, Pencil, Trash2, Check, Wallet, Clock, AlertTriangle, CircleCheck, Euro, Banknote, Search } from "lucide-react"
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

type Tab = "factures" | "ca" | "missions"

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
  const [editingFacture, setEditingFacture] = useState<FactureRow | null>(null)
  const [showPayMission, setShowPayMission] = useState<MissionPayRow | null>(null)

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
        <button
          onClick={() => { setEditingFacture(null); setShowModal(true) }}
          disabled={data.migrationMissing}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Nouvelle facture
        </button>
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
    date_emission: facture?.date_emission ?? "",
    date_echeance: facture?.date_echeance ?? "",
    date_paiement: facture?.date_paiement ?? "",
    notes: facture?.notes ?? "",
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
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
