"use client"

import { useEffect, useState } from "react"
import { getEtudes, createEtude, updateEtude, getClients, getMembers, getParametre, deleteEtude } from "@/lib/actions/etudes"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { X, Loader2, Trash2, Pencil } from "lucide-react"
import type { EtudeWithRelations, Client } from "@/types/database.types"

const STATUT_CONFIG: Record<string, { label: string; chipClass: string; dotClass: string }> = {
  prospection: {
    label: "Prospection",
    chipClass: "bg-amber-100 text-amber-700",
    dotClass: "bg-amber-500",
  },
  en_cours_prospection: {
    label: "En cours de prospection",
    chipClass: "bg-cyan-100 text-cyan-700",
    dotClass: "bg-cyan-500",
  },
  signee: {
    label: "Signée",
    chipClass: "bg-emerald-100 text-emerald-700",
    dotClass: "bg-emerald-500",
  },
  en_cours: {
    label: "En cours",
    chipClass: "bg-blue-100 text-blue-700",
    dotClass: "bg-blue-500",
  },
  terminee: {
    label: "Terminée",
    chipClass: "bg-slate-100 text-slate-600",
    dotClass: "bg-slate-400",
  },
}

const STATUT_ORDER: Record<string, number> = {
  prospection: 0,
  en_cours_prospection: 1,
  signee: 2,
  en_cours: 3,
  terminee: 4,
}

export default function EtudesPage() {
  const [etudes, setEtudes] = useState<EtudeWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatut, setSelectedStatut] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ nom: "", numero: "", statut: "prospect", budget: "", budget_ht: "", type: "", commentaire: "", client_id: "", suiveur_id: "" })
  const [tvaRate, setTvaRate] = useState(20)
  const [clients, setClients] = useState<Client[]>([])
  const [membres, setMembres] = useState<{ id: string; prenom: string | null; nom: string | null }[]>([])

  useEffect(() => {
    const loadEtudes = async () => {
      setLoading(true)
      const [etudesResult, clientsResult, membresResult] = await Promise.all([
        getEtudes(), getClients(), getMembers()
      ])
      if (etudesResult.data) setEtudes(etudesResult.data)
      if (clientsResult.data) setClients(clientsResult.data as Client[])
      if (membresResult.data) setMembres(membresResult.data)
      setLoading(false)
    }
    loadEtudes()
    getParametre("tva_rate").then(v => { if (v) setTvaRate(Number(v)) })
  }, [])

  const filteredEtudes = etudes
    .filter((etude) => {
      const matchesSearch =
        etude.nom.toLowerCase().includes(searchTerm.toLowerCase()) ||
        etude.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        etude.clients?.nom.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatut = !selectedStatut || etude.statut === selectedStatut
      return matchesSearch && matchesStatut
    })
    .sort((a, b) => STATUT_ORDER[a.statut] - STATUT_ORDER[b.statut])

  const groupedByStatut = etudes.reduce(
    (acc, etude) => {
      const s = etude.statut
      acc[s] = (acc[s] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  // Active/featured study
  const activeStudy = filteredEtudes.find((e) => e.statut === "en_cours")

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">
            Study Management
          </p>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Études</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestion des études et projets clients</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setForm({ nom: "", numero: "", statut: "prospect", budget: "", budget_ht: "", type: "", commentaire: "", client_id: "", suiveur_id: "" }); setShowModal(true); setFormError(null) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          Nouvelle étude
        </button>
      </div>

      {/* Status chips filter row */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedStatut(null)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
            !selectedStatut
              ? "bg-[#00236f] text-white border-[#00236f]"
              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
          }`}
        >
          Toutes ({etudes.length})
        </button>
        {Object.entries(STATUT_CONFIG).map(([statut, config]) => (
          <button
            key={statut}
            onClick={() => setSelectedStatut(selectedStatut === statut ? null : statut)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              selectedStatut === statut
                ? "bg-[#00236f] text-white border-[#00236f]"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
            {config.label} ({groupedByStatut[statut] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
        <input
          type="search"
          placeholder="Rechercher une étude par nom, numéro ou client..."
          className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 shadow-sm"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Active study detail panel */}
          {activeStudy && (
            <div className="lg:col-span-8">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 mb-3">
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-600 uppercase tracking-wide">
                        Priorité haute
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUT_CONFIG[activeStudy.statut]?.chipClass}`}>
                        {STATUT_CONFIG[activeStudy.statut]?.label}
                      </span>
                    </div>
                    <h2 className="text-xl font-manrope font-black text-[#00236f] mb-1">{activeStudy.nom}</h2>
                    <p className="text-sm text-slate-400 font-mono">{activeStudy.numero}</p>
                  </div>
                  {activeStudy.budget && (
                    <div className="text-right">
                      <p className="text-xs text-slate-400">Budget</p>
                      <p className="text-2xl font-manrope font-black text-[#00236f]">€{activeStudy.budget.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-xl mb-5">
                  {activeStudy.clients && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Client</p>
                      <p className="text-sm font-semibold text-slate-800">{activeStudy.clients.nom}</p>
                    </div>
                  )}
                  {activeStudy.suiveur && (
                    <div>
                      <p className="text-xs text-slate-400 mb-1">Suiveur</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {activeStudy.suiveur.prenom} {activeStudy.suiveur.nom}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-400 mb-1">Statut</p>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUT_CONFIG[activeStudy.statut]?.chipClass}`}>
                      {STATUT_CONFIG[activeStudy.statut]?.label}
                    </span>
                  </div>
                </div>

                {activeStudy.commentaire && (
                  <div className="p-4 bg-[#d0d8ff]/30 rounded-xl mb-4">
                    <p className="text-xs font-semibold text-[#00236f] mb-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-base">comment</span>
                      Commentaires
                    </p>
                    <p className="text-sm text-slate-600">{activeStudy.commentaire}</p>
                  </div>
                )}

                <Link
                  href={`/etudes/${activeStudy.id}`}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors w-fit"
                >
                  Voir l'échéancier complet
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </Link>
              </div>
            </div>
          )}

          {/* Studies list panel */}
          <div className={activeStudy ? "lg:col-span-4" : "lg:col-span-12"}>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-manrope font-bold text-[#00236f] text-base">
                  {filteredEtudes.length} étude{filteredEtudes.length !== 1 ? "s" : ""}
                </h2>
              </div>
              <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                {filteredEtudes.length > 0 ? (
                  filteredEtudes.map((etude) => {
                    const sc = STATUT_CONFIG[etude.statut as keyof typeof STATUT_CONFIG]
                    return (
                      <div key={etude.id} className="group flex items-center gap-3 px-5 py-4 hover:bg-slate-50 transition-colors">
                        <Link href={`/etudes/${etude.id}`} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${sc?.dotClass || "bg-slate-300"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-800 truncate">{etude.nom}</p>
                            <p className="text-xs text-slate-400 truncate">{etude.numero} {etude.clients ? `· ${etude.clients.nom}` : ""}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc?.chipClass || "bg-slate-100 text-slate-600"}`}>
                              {sc?.label || etude.statut}
                            </span>
                            {etude.budget && (
                              <span className="text-xs font-bold text-[#00236f]">€{etude.budget.toLocaleString()}</span>
                            )}
                          </div>
                        </Link>
                        <button
                          onClick={(e) => {
                            e.preventDefault(); e.stopPropagation()
                            setEditingId(etude.id)
                            setForm({
                              nom: etude.nom ?? "",
                              numero: etude.numero ?? "",
                              statut: etude.statut ?? "prospect",
                              budget: etude.budget?.toString() ?? "",
                              budget_ht: etude.budget_ht?.toString() ?? "",
                              type: etude.type ?? "",
                              commentaire: etude.commentaire ?? "",
                              client_id: etude.client_id ?? "",
                              suiveur_id: etude.suiveur_id ?? "",
                            })
                            setShowModal(true)
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-slate-400 hover:text-[#00236f] hover:bg-[#d0d8ff] transition-all shrink-0"
                          title="Modifier l'étude"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={async (e) => {
                            e.preventDefault(); e.stopPropagation()
                            if (!confirm(`Supprimer l'étude "${etude.nom}" ? Cette action est irréversible.`)) return
                            const res = await deleteEtude(etude.id)
                            if (res.error) { alert(res.error); return }
                            setEtudes(prev => prev.filter(x => x.id !== etude.id))
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all shrink-0"
                          title="Supprimer l'étude"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                    <span className="material-symbols-outlined text-4xl mb-2">school</span>
                    <p className="text-sm">
                      {searchTerm || selectedStatut ? "Aucune étude correspondante" : "Créez votre première étude"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale Nouvelle étude ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
              <h2 className="font-manrope font-bold text-[#00236f] text-lg">{editingId ? "Modifier l'étude" : "Nouvelle étude"}</h2>
              <button onClick={() => { setShowModal(false); setEditingId(null) }} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                setSubmitting(true)
                setFormError(null)
                const payload = {
                  nom: form.nom,
                  numero: form.numero,
                  statut: form.statut,
                  type: form.type || undefined,
                  budget: form.budget ? Number(form.budget) : undefined,
                  budget_ht: form.budget_ht ? Number(form.budget_ht) : undefined,
                  commentaire: form.commentaire || undefined,
                  client_id: form.client_id || undefined,
                  suiveur_id: form.suiveur_id || undefined,
                }
                const result = editingId
                  ? await updateEtude(editingId, payload as any)
                  : await createEtude(payload)
                setSubmitting(false)
                if ((result as any).error) { setFormError((result as any).error); return }
                setShowModal(false)
                setEditingId(null)
                setForm({ nom: "", numero: "", statut: "prospect", budget: "", budget_ht: "", type: "", commentaire: "", client_id: "", suiveur_id: "" })
                // Refresh list
                const fresh = await getEtudes()
                if (fresh.data) setEtudes(fresh.data)
              }}
              className="p-6 space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Nom de l&apos;étude *</label>
                  <input
                    required
                    value={form.nom}
                    onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                    placeholder="Ex : Étude marketing Q3"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Numéro *</label>
                  <input
                    required
                    value={form.numero}
                    onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                    placeholder="Ex : 2024-001"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Budget HT (€)</label>
                  <input
                    type="number"
                    value={form.budget_ht}
                    onChange={e => setForm(f => ({ ...f, budget_ht: e.target.value }))}
                    placeholder="Ex : 5000"
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Budget TTC : {form.budget_ht ? (Number(form.budget_ht) * (1 + tvaRate / 100)).toFixed(2) : "—"} €
                  </p>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Type d&apos;étude *</label>
                  <select
                    required
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  >
                    <option value="">— Sélectionner —</option>
                    <option value="ao">AO</option>
                    <option value="cs">CS</option>
                    <option value="prospection">Prospection</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Client</label>
                  <select
                    value={form.client_id}
                    onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  >
                    <option value="">— Sélectionner —</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Suiveur</label>
                  <select
                    value={form.suiveur_id}
                    onChange={e => setForm(f => ({ ...f, suiveur_id: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  >
                    <option value="">— Sélectionner —</option>
                    {membres.map(m => <option key={m.id} value={m.id}>{m.prenom} {m.nom}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Statut</label>
                  <select
                    value={form.statut}
                    onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  >
                    <option value="prospection">Prospection</option>
                    <option value="en_cours_prospection">En cours de prospection</option>
                    <option value="signee">Signée</option>
                    <option value="en_cours">En cours</option>
                    <option value="terminee">Terminée</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Commentaire</label>
                  <textarea
                    value={form.commentaire}
                    onChange={e => setForm(f => ({ ...f, commentaire: e.target.value }))}
                    rows={3}
                    placeholder="Notes, contexte..."
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 resize-none"
                  />
                </div>
              </div>

              {formError && (
                <p className="text-xs text-red-500 font-medium">{formError}</p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null) }} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#00236f] text-white rounded-lg hover:bg-[#1e3a8a] transition-colors disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingId ? "Enregistrer" : "Créer l'étude"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
