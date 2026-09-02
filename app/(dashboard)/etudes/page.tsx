"use client"

import { useEffect, useState } from "react"
import { getEtudes, createEtude, updateEtude, getClients, createClient_ as addClient, getMembers, getParametre, deleteEtude, toggleEtudePublished } from "@/lib/actions/etudes"
import { Skeleton } from "@/components/ui/skeleton"
import { MultiSelect } from "@/components/ui/multi-select"
import Link from "next/link"
import { X, Loader2, Trash2, Pencil, Eye, EyeOff, AlertTriangle } from "lucide-react"
import type { EtudeWithRelations, Client } from "@/types/database.types"
import { useUser } from "@/hooks/useUser"
import { canEditEtude, hasPermission } from "@/lib/auth/permissions"

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
    chipClass: "bg-zinc-100 text-zinc-600",
    dotClass: "bg-zinc-400",
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
  const { profile } = useUser()
  const canPublish = hasPermission(profile, "publier_etudes")
  const [etudes, setEtudes] = useState<EtudeWithRelations[]>([])
  const [publishConfirmEtude, setPublishConfirmEtude] = useState<EtudeWithRelations | null>(null)
  const [publishConfirmChecked, setPublishConfirmChecked] = useState(false)
  const [publishSubmitting, setPublishSubmitting] = useState(false)
  const [deleteConfirmEtude, setDeleteConfirmEtude] = useState<EtudeWithRelations | null>(null)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStatut, setSelectedStatut] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ nom: "", numero: "", statut: "prospect", budget: "", budget_ht: "", frais_dossier: "", marge_pct: "", type: "", commentaire: "", client_id: "", suiveur_ids: [] as string[] })
  const [tvaRate, setTvaRate] = useState(20)
  const [clients, setClients] = useState<Client[]>([])
  const [membres, setMembres] = useState<{ id: string; prenom: string | null; nom: string | null }[]>([])
  const [showNewClient, setShowNewClient] = useState(false)
  const [newClient, setNewClient] = useState({
    nom: "", secteur: "", contact_civilite: "", contact_prenom: "", contact_nom: "",
    contact_poste: "", contact_email: "", contact_phone: "", adresse: "", code_postal: "", ville: "",
  })
  const [creatingClient, setCreatingClient] = useState(false)
  const [newClientError, setNewClientError] = useState<string | null>(null)

  const handleCreateClient = async () => {
    if (!newClient.nom.trim()) { setNewClientError("Le nom du client est requis."); return }
    setCreatingClient(true)
    setNewClientError(null)
    const result = await addClient({
      nom: newClient.nom,
      secteur: newClient.secteur || undefined,
      contact_civilite: newClient.contact_civilite || undefined,
      contact_prenom: newClient.contact_prenom || undefined,
      contact_nom: newClient.contact_nom || undefined,
      contact_poste: newClient.contact_poste || undefined,
      contact_email: newClient.contact_email || undefined,
      contact_phone: newClient.contact_phone || undefined,
      adresse: newClient.adresse || undefined,
      code_postal: newClient.code_postal || undefined,
      ville: newClient.ville || undefined,
    })
    setCreatingClient(false)
    if ((result as any).error) { setNewClientError((result as any).error); return }
    const created = (result as any).data as Client
    setClients(prev => [...prev, created].sort((a, b) => a.nom.localeCompare(b.nom)))
    setForm(f => ({ ...f, client_id: created.id }))
    setShowNewClient(false)
    setNewClient({
      nom: "", secteur: "", contact_civilite: "", contact_prenom: "", contact_nom: "",
      contact_poste: "", contact_email: "", contact_phone: "", adresse: "", code_postal: "", ville: "",
    })
  }

  useEffect(() => {
    const loadEtudes = async () => {
      setLoading(true)
      const [etudesResult, clientsResult, membresResult] = await Promise.all([
        getEtudes(), getClients(), getMembers()
      ])
      console.log("[EtudesPage] getEtudes result:", JSON.stringify(etudesResult))
      if ((etudesResult as any).error) {
        console.error("[EtudesPage] getEtudes ERROR:", (etudesResult as any).error)
      }
      if ((etudesResult as any).data) setEtudes((etudesResult as any).data)
      if ((clientsResult as any).data) setClients((clientsResult as any).data as Client[])
      if ((membresResult as any).data) setMembres((membresResult as any).data)
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

  const handleTogglePublish = async (etude: EtudeWithRelations) => {
    const newPublished = !(etude as any).published
    // Passage brouillon → visible : on demande confirmation (missions publiées ?)
    if (newPublished) {
      setPublishConfirmChecked(false)
      setPublishConfirmEtude(etude)
      return
    }
    const res = await toggleEtudePublished(etude.id, newPublished)
    if ((res as any).error) { alert((res as any).error); return }
    setEtudes(prev => prev.map(x => x.id === etude.id ? { ...x, published: newPublished } as any : x))
  }

  const handleConfirmPublish = async () => {
    if (!publishConfirmEtude || !publishConfirmChecked) return
    setPublishSubmitting(true)
    const res = await toggleEtudePublished(publishConfirmEtude.id, true)
    setPublishSubmitting(false)
    if ((res as any).error) { alert((res as any).error); return }
    setEtudes(prev => prev.map(x => x.id === publishConfirmEtude.id ? { ...x, published: true } as any : x))
    setPublishConfirmEtude(null)
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirmEtude) return
    setDeleteSubmitting(true)
    const res = await deleteEtude(deleteConfirmEtude.id)
    setDeleteSubmitting(false)
    if ((res as any).error) { alert((res as any).error); return }
    setEtudes(prev => prev.filter(x => x.id !== deleteConfirmEtude.id))
    setDeleteConfirmEtude(null)
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-1">
            Study Management
          </p>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Études</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Gestion des études et projets clients</p>
        </div>
        <button
          onClick={() => { setEditingId(null); setForm({ nom: "", numero: "", statut: "prospect", budget: "", budget_ht: "", frais_dossier: "", marge_pct: "", type: "", commentaire: "", client_id: "", suiveur_ids: [] as string[] }); setShowModal(true); setFormError(null) }}
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
              : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
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
                : "bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-50"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${config.dotClass}`} />
            {config.label} ({groupedByStatut[statut] || 0})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-lg">search</span>
        <input
          type="search"
          placeholder="Rechercher une étude par nom, numéro ou client..."
          className="w-full h-10 pl-9 pr-4 rounded-xl border border-zinc-200 bg-white text-sm text-zinc-700 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 shadow-sm"
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
              <div className="bg-white rounded-xl border border-zinc-200 shadow-sm p-6">
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
                    <p className="text-sm text-zinc-400 font-mono">{activeStudy.numero}</p>
                  </div>
                  {activeStudy.budget && (
                    <div className="text-right">
                      <p className="text-xs text-zinc-400">Budget</p>
                      <p className="text-2xl font-manrope font-black text-[#00236f]">€{activeStudy.budget.toLocaleString()}</p>
                    </div>
                  )}
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-zinc-50 rounded-xl mb-5">
                  {activeStudy.clients && (
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Client</p>
                      <p className="text-sm font-semibold text-zinc-800">{activeStudy.clients.nom}</p>
                    </div>
                  )}
                  {((activeStudy.suiveurs && activeStudy.suiveurs.length > 0) || activeStudy.suiveur) && (
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Suiveur{(activeStudy.suiveurs?.length ?? 0) > 1 ? "s" : ""}</p>
                      <p className="text-sm font-semibold text-zinc-800">
                        {(activeStudy.suiveurs && activeStudy.suiveurs.length > 0)
                          ? activeStudy.suiveurs.map(s => `${s.prenom} ${s.nom}`).join(", ")
                          : `${activeStudy.suiveur!.prenom} ${activeStudy.suiveur!.nom}`}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-zinc-400 mb-1">Statut</p>
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
                    <p className="text-sm text-zinc-600">{activeStudy.commentaire}</p>
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
            <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-100">
                <h2 className="font-manrope font-bold text-[#00236f] text-base">
                  {filteredEtudes.length} étude{filteredEtudes.length !== 1 ? "s" : ""}
                </h2>
              </div>
              <div className="divide-y divide-zinc-100 max-h-[600px] overflow-y-auto">
                {filteredEtudes.length > 0 ? (
                  filteredEtudes.map((etude) => {
                    const sc = STATUT_CONFIG[etude.statut as keyof typeof STATUT_CONFIG]
                    return (
                      <div key={etude.id} className="group flex items-center gap-3 px-5 py-4 hover:bg-zinc-50 transition-colors">
                        <Link href={`/etudes/${etude.id}`} className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${sc?.dotClass || "bg-zinc-300"}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-zinc-800 truncate">{etude.nom}</p>
                            <p className="text-xs text-zinc-400 truncate">
                              {etude.numero}
                              {etude.clients ? ` · ${etude.clients.nom}` : ""}
                              {(etude.suiveurs && etude.suiveurs.length > 0)
                                ? ` · Suiveur${etude.suiveurs.length > 1 ? "s" : ""} : ${etude.suiveurs.map(s => `${s.prenom} ${s.nom}`).join(", ")}`
                                : (etude as any).suiveur ? ` · Suiveur : ${(etude as any).suiveur.prenom} ${(etude as any).suiveur.nom}` : ""}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <div className="flex items-center gap-1.5">
                              {!(etude as any).published && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                                  BROUILLON
                                </span>
                              )}
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc?.chipClass || "bg-zinc-100 text-zinc-600"}`}>
                                {sc?.label || etude.statut}
                              </span>
                            </div>
                            {(etude.budget_ht ?? etude.budget) != null && (
                              <span className="text-xs font-bold text-[#00236f]">
                                {Number(etude.budget_ht ?? etude.budget).toLocaleString("fr-FR")} € HT
                              </span>
                            )}
                          </div>
                        </Link>
                        {canPublish && (
                          <button
                            onClick={(e) => {
                              e.preventDefault(); e.stopPropagation()
                              handleTogglePublish(etude)
                            }}
                            className={`p-1.5 rounded-md transition-all shrink-0 ${(etude as any).published ? "text-emerald-600 hover:bg-emerald-50" : "text-amber-600 hover:bg-amber-50"}`}
                            title={(etude as any).published ? "Dépublier" : "Publier"}
                          >
                            {(etude as any).published ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                        )}
                        {canEditEtude(profile, etude) && (
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
                              frais_dossier: (etude as any).frais_dossier?.toString() ?? "",
                              marge_pct: (etude as any).marge_pct?.toString() ?? "",
                              type: etude.type ?? "",
                              commentaire: etude.commentaire ?? "",
                              client_id: etude.client_id ?? "",
                              suiveur_ids: (etude.suiveurs && etude.suiveurs.length > 0)
                                ? etude.suiveurs.map(s => s.id)
                                : (etude.suiveur_id ? [etude.suiveur_id] : []),
                            })
                            setShowModal(true)
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-zinc-400 hover:text-[#00236f] hover:bg-[#d0d8ff] transition-all shrink-0"
                          title="Modifier l'étude"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        )}
                        {canEditEtude(profile, etude) && (
                        <button
                          onClick={(e) => {
                            e.preventDefault(); e.stopPropagation()
                            setDeleteConfirmEtude(etude)
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-all shrink-0"
                          title="Supprimer l'étude"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        )}
                      </div>
                    )
                  })
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-400">
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => { setShowModal(false); setEditingId(null) }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 shrink-0">
              <h2 className="font-manrope font-bold text-[#00236f] text-lg">{editingId ? "Modifier l'étude" : "Nouvelle étude"}</h2>
              <button onClick={() => { setShowModal(false); setEditingId(null) }} className="text-zinc-400 hover:text-zinc-600 transition-colors">
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
                  frais_dossier: form.frais_dossier ? Number(form.frais_dossier) : undefined,
                  marge_pct: form.marge_pct ? Number(form.marge_pct) : undefined,
                  commentaire: form.commentaire || undefined,
                  client_id: form.client_id || undefined,
                  suiveur_ids: form.suiveur_ids,
                }
                const result = editingId
                  ? await updateEtude(editingId, payload as any)
                  : await createEtude(payload)
                setSubmitting(false)
                if ((result as any).error) { setFormError((result as any).error); return }
                setShowModal(false)
                setEditingId(null)
                setForm({ nom: "", numero: "", statut: "prospect", budget: "", budget_ht: "", frais_dossier: "", marge_pct: "", type: "", commentaire: "", client_id: "", suiveur_ids: [] as string[] })
                // Refresh list
                const fresh = await getEtudes()
                if ((fresh as any).data) setEtudes((fresh as any).data)
              }}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Nom de l&apos;étude *</label>
                  <input
                    required
                    value={form.nom}
                    onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                    placeholder="Ex : Étude marketing Q3"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Numéro *</label>
                  <input
                    required
                    value={form.numero}
                    onChange={e => setForm(f => ({ ...f, numero: e.target.value }))}
                    placeholder="Ex : 2024-001"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Budget HT (€)</label>
                  <input
                    type="number"
                    value={form.budget_ht}
                    onChange={e => setForm(f => ({ ...f, budget_ht: e.target.value }))}
                    placeholder="Ex : 5000"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                  <p className="text-xs text-zinc-400 mt-1">
                    Budget TTC : {form.budget_ht ? (Number(form.budget_ht) * (1 + tvaRate / 100)).toFixed(2) : "—"} €
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Frais de dossier (€)</label>
                  <input
                    type="number"
                    value={form.frais_dossier}
                    onChange={e => setForm(f => ({ ...f, frais_dossier: e.target.value }))}
                    placeholder="Ex : 150"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Marge (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={form.marge_pct}
                    onChange={e => setForm(f => ({ ...f, marge_pct: e.target.value }))}
                    placeholder="Ex : 10"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                </div>
                <div className="col-span-2 rounded-lg bg-[#00236f]/[0.04] border border-[#00236f]/20 p-3 text-xs text-[#00236f]">
                  {(() => {
                    const base = Number(form.budget_ht) || 0
                    const frais = Number(form.frais_dossier) || 0
                    const margePct = Number(form.marge_pct) || 0
                    // Le budget HT est saisi marge comprise : la marge n'est
                    // qu'affichée à titre informatif, jamais rajoutée au total.
                    const margeEuros = base * (margePct / 100)
                    const tarifTotal = base + frais
                    return (
                      <div className="flex flex-wrap gap-x-4 gap-y-1">
                        <span>Budget HT (marge comprise) : <strong>{base.toLocaleString("fr-FR")} €</strong></span>
                        <span>+ Frais : <strong>{frais.toLocaleString("fr-FR")} €</strong></span>
                        <span>dont Marge ({margePct}%) : <strong>{margeEuros.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €</strong></span>
                        <span className="ml-auto">= Tarif étude HT : <strong className="text-sm">{tarifTotal.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} €</strong></span>
                      </div>
                    )
                  })()}
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Type d&apos;étude *</label>
                  <select
                    required
                    value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  >
                    <option value="">— Sélectionner —</option>
                    <option value="ao">AO</option>
                    <option value="cs">CS</option>
                    <option value="prospection">Prospection</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Client</label>
                  <div className="flex gap-2">
                    <select
                      value={form.client_id}
                      onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                      className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                    >
                      <option value="">— Sélectionner —</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowNewClient(v => !v)}
                      className="shrink-0 px-3 py-2 text-xs font-semibold border border-[#00236f]/30 rounded-lg text-[#00236f] hover:bg-[#00236f]/5"
                    >
                      {showNewClient ? "Annuler" : "+ Nouveau"}
                    </button>
                  </div>
                </div>
                {showNewClient && (
                  <div className="col-span-2 rounded-lg border border-[#00236f]/20 bg-[#00236f]/[0.03] p-3 space-y-3">
                    <p className="text-xs font-semibold text-[#00236f]">Nouveau client</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="block text-xs font-semibold text-zinc-600 mb-1">Nom du client *</label>
                        <input
                          value={newClient.nom}
                          onChange={e => setNewClient(c => ({ ...c, nom: e.target.value }))}
                          placeholder="Ex : Danone"
                          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 mb-1">Secteur</label>
                        <input
                          value={newClient.secteur}
                          onChange={e => setNewClient(c => ({ ...c, secteur: e.target.value }))}
                          placeholder="Ex : Agroalimentaire"
                          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 mb-1">Adresse</label>
                        <input
                          value={newClient.adresse}
                          onChange={e => setNewClient(c => ({ ...c, adresse: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 mb-1">Code postal</label>
                        <input
                          value={newClient.code_postal}
                          onChange={e => setNewClient(c => ({ ...c, code_postal: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 mb-1">Ville</label>
                        <input
                          value={newClient.ville}
                          onChange={e => setNewClient(c => ({ ...c, ville: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                        />
                      </div>
                      <p className="col-span-2 text-[11px] font-semibold text-zinc-500 pt-1">Interlocuteur (pour les documents)</p>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 mb-1">Civilité</label>
                        <select
                          value={newClient.contact_civilite}
                          onChange={e => setNewClient(c => ({ ...c, contact_civilite: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                        >
                          <option value="">—</option>
                          <option value="Monsieur">Monsieur</option>
                          <option value="Madame">Madame</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 mb-1">Poste</label>
                        <input
                          value={newClient.contact_poste}
                          onChange={e => setNewClient(c => ({ ...c, contact_poste: e.target.value }))}
                          placeholder="Ex : Directeur marketing"
                          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 mb-1">Prénom</label>
                        <input
                          value={newClient.contact_prenom}
                          onChange={e => setNewClient(c => ({ ...c, contact_prenom: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 mb-1">Nom</label>
                        <input
                          value={newClient.contact_nom}
                          onChange={e => setNewClient(c => ({ ...c, contact_nom: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 mb-1">Email</label>
                        <input
                          type="email"
                          value={newClient.contact_email}
                          onChange={e => setNewClient(c => ({ ...c, contact_email: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-zinc-600 mb-1">Téléphone</label>
                        <input
                          value={newClient.contact_phone}
                          onChange={e => setNewClient(c => ({ ...c, contact_phone: e.target.value }))}
                          className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                        />
                      </div>
                    </div>
                    {newClientError && <p className="text-xs text-red-500 font-medium">{newClientError}</p>}
                    <button
                      type="button"
                      disabled={creatingClient}
                      onClick={handleCreateClient}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-[#00236f] rounded-lg hover:bg-[#00236f]/90 disabled:opacity-50"
                    >
                      {creatingClient ? "Création..." : "Créer le client"}
                    </button>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Suiveur(s)</label>
                  <MultiSelect
                    options={membres.map(m => ({ value: m.id, label: `${m.prenom ?? ""} ${m.nom ?? ""}`.trim() }))}
                    selected={form.suiveur_ids}
                    onChange={ids => setForm(f => ({ ...f, suiveur_ids: ids }))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Statut</label>
                  <select
                    value={form.statut}
                    onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  >
                    <option value="prospection">Prospection</option>
                    <option value="en_cours_prospection">En cours de prospection</option>
                    <option value="signee">Signée</option>
                    <option value="en_cours">En cours</option>
                    <option value="terminee">Terminée</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Commentaire</label>
                  <textarea
                    value={form.commentaire}
                    onChange={e => setForm(f => ({ ...f, commentaire: e.target.value }))}
                    rows={3}
                    placeholder="Notes, contexte..."
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 resize-none"
                  />
                </div>
              </div>

              {formError && (
                <p className="text-xs text-red-500 font-medium">{formError}</p>
              )}
              </div>

              <div className="flex justify-end gap-3 px-6 py-4 border-t border-zinc-100 shrink-0">
                <button type="button" onClick={() => { setShowModal(false); setEditingId(null) }} className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
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

      {/* ── Modale de confirmation : passage brouillon → visible ── */}
      {publishConfirmEtude && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setPublishConfirmEtude(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-lg font-manrope font-bold text-zinc-900">Publier l&apos;étude</h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Vous êtes sur le point de rendre l&apos;étude{" "}
                  <span className="font-semibold text-zinc-800">"{publishConfirmEtude.nom}"</span> visible.
                </p>
                <p className="text-sm text-zinc-500 mt-2">
                  Assurez-vous bien que les missions relatives à cette étude ont été publiées.
                </p>
              </div>
            </div>

            <label className="flex items-center gap-2 mt-4 p-3 bg-amber-50 rounded-lg border border-amber-200 cursor-pointer">
              <input
                type="checkbox"
                checked={publishConfirmChecked}
                onChange={(e) => setPublishConfirmChecked(e.target.checked)}
                className="rounded border-zinc-300"
              />
              <span className="text-sm font-medium text-amber-800">
                Oui, les missions ont bien été publiées
              </span>
            </label>

            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setPublishConfirmEtude(null)}
                className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={!publishConfirmChecked || publishSubmitting}
                onClick={handleConfirmPublish}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-[#00236f] text-white rounded-lg hover:bg-[#1e3a8a] transition-colors disabled:opacity-50"
              >
                {publishSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Publier l&apos;étude
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modale de confirmation : suppression d'une étude ── */}
      {deleteConfirmEtude && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setDeleteConfirmEtude(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl text-red-600">warning</span>
              </div>
              <div>
                <h2 className="text-lg font-manrope font-bold text-zinc-900">Supprimer l&apos;étude</h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Êtes-vous certain de vouloir supprimer l&apos;étude{" "}
                  <span className="font-semibold text-zinc-800">"{deleteConfirmEtude.nom}"</span> ?
                </p>
                <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-xs text-red-700 font-medium">
                    ⚠️ Cette action est irréversible : ses missions, candidatures et documents liés
                    seront supprimés avec elle.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-5">
              <button
                type="button"
                onClick={() => setDeleteConfirmEtude(null)}
                className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={handleConfirmDelete}
                className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleteSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
