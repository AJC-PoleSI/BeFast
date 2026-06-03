"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Loader2, Save, Search, ChevronLeft, Layers, Plus, Archive, ArchiveRestore, X, Sparkles, FileText } from "lucide-react"
import {
  getPhasesDefaut, savePhaseDefaut, createPhaseDefaut, setPhaseArchived,
  getPrixNetMoyenParPhase, getPhasesStats, getSuggestedPhases, integrateSuggestedPhase,
  getMyPhasePermissions, type PhaseDefaut,
} from "@/lib/actions/phases"
import { getParametres, saveParametres, type ParametresMap } from "@/lib/actions/parametres"
import { toast } from "sonner"

const CONTENU_FIELDS = [
  { key: "propale_context_situation_default", label: "Contexte — Votre situation" },
  { key: "propale_context_intervention_default", label: "Contexte — Notre domaine d'intervention" },
  { key: "propale_context_enjeu_default", label: "Contexte — L'enjeu" },
  { key: "propale_cdc_objectifs_default", label: "Cahier des charges — Objectifs globaux" },
  { key: "propale_cdc_contraintes_default", label: "Cahier des charges — Contraintes globales" },
  { key: "propale_cdc_livrables_default", label: "Cahier des charges — Livrables attendus" },
]
const CONTENU_KEYS = CONTENU_FIELDS.map((f) => f.key)

type Stats = Awaited<ReturnType<typeof getPhasesStats>>["data"]

export default function PilotagePhasesPage() {
  const [phases, setPhases] = useState<PhaseDefaut[]>([])
  const [netParPhase, setNetParPhase] = useState<Record<string, number>>({})
  const [stats, setStats] = useState<Stats | null>(null)
  const [suggested, setSuggested] = useState<string[]>([])
  const [perms, setPerms] = useState({ isAdmin: false, isSuper: false })
  const [contenu, setContenu] = useState<ParametresMap>({})
  const [showArchived, setShowArchived] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [savingId, setSavingId] = useState<number | null>(null)
  const [archiveTarget, setArchiveTarget] = useState<PhaseDefaut | null>(null)
  const [savingContenu, setSavingContenu] = useState(false)

  const loadAll = async (withArchived = showArchived) => {
    const [p, net, st, sg, pm, params] = await Promise.all([
      getPhasesDefaut(withArchived), getPrixNetMoyenParPhase(), getPhasesStats(),
      getSuggestedPhases(), getMyPhasePermissions(), getParametres(),
    ])
    if (p.error) setError(p.error)
    else setPhases(p.data ?? [])
    setNetParPhase(net.data ?? {})
    setStats(st.data)
    setSuggested(sg.data ?? [])
    setPerms(pm)
    if (params.data) {
      const c: ParametresMap = {}
      for (const k of CONTENU_KEYS) c[k] = params.data[k] ?? ""
      setContenu(c)
    }
  }

  useEffect(() => { loadAll().finally(() => setLoading(false)) }, [])
  useEffect(() => { if (!loading) getPhasesDefaut(showArchived).then((r) => r.data && setPhases(r.data)) }, [showArchived])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return phases
    return phases.filter((p) => `${p.nom} ${p.objectifs ?? ""}`.toLowerCase().includes(q))
  }, [phases, search])

  const patch = (id: number, field: keyof PhaseDefaut, value: any) =>
    setPhases((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)))

  const handleSavePhase = async (phase: PhaseDefaut) => {
    setSavingId(phase.id)
    const { archived, ...rest } = phase
    const res = await savePhaseDefaut(rest)
    setSavingId(null)
    if (res.success) toast.success(`Phase « ${phase.nom} » enregistrée`, { position: "top-right" })
    else toast.error(res.error ?? "Erreur", { position: "top-right" })
  }

  const handleAdd = async () => {
    const res = await createPhaseDefaut()
    if (res.error) { toast.error(res.error, { position: "top-right" }); return }
    await loadAll()
    toast.success("Phase ajoutée", { position: "top-right" })
  }

  const handleArchive = async (phase: PhaseDefaut, archived: boolean) => {
    const res = await setPhaseArchived(phase.id, archived)
    if (res.success) { await loadAll(); toast.success(archived ? "Phase archivée" : "Phase désarchivée", { position: "top-right" }) }
    else toast.error(res.error ?? "Erreur", { position: "top-right" })
    setArchiveTarget(null)
  }

  const handleIntegrate = async (nom: string) => {
    const res = await integrateSuggestedPhase(nom)
    if (res.success) { await loadAll(); toast.success(`« ${nom} » intégrée au catalogue`, { position: "top-right" }) }
    else toast.error(res.error ?? "Erreur", { position: "top-right" })
  }

  const handleSaveContenu = async () => {
    setSavingContenu(true)
    const res = await saveParametres(contenu)
    setSavingContenu(false)
    if (res.success) toast.success("Textes par défaut enregistrés", { position: "top-right" })
    else toast.error(res.error ?? "Erreur", { position: "top-right" })
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-7 h-7 animate-spin text-[#00236f]" /></div>
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 space-y-6">
      <div>
        <Link href="/prospection" className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-[#00236f] mb-1">
          <ChevronLeft className="w-4 h-4" /> Retour à la prospection
        </Link>
        <h1 className="text-2xl font-manrope font-black text-[#00236f] flex items-center gap-2">
          <Layers className="w-6 h-6" /> Pilotage des phases
        </h1>
        <p className="text-sm text-zinc-500 mt-1">
          Personnalisez le JEH par défaut, le nombre d'intervenants et le contenu de chaque phase.
        </p>
      </div>

      {/* BANDEAU STATS */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Phases actives" value={stats.nbPhasesActives} />
          <StatCard label="Propales" value={stats.nbPropales} />
          <StatCard label="CE signées" value={stats.nbCeSignees} />
          <StatCard label="Taux conversion" value={`${stats.tauxConversion} %`} accent />
          <StatCard label="Phase n°1" value={stats.phasePlusUtilisee ?? "—"} small />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">Impossible de charger les phases.</p>
          <p>Vérifie que les migrations <code className="font-mono">029</code> et <code className="font-mono">032</code> sont appliquées.</p>
          <p className="text-xs font-mono mt-2 bg-amber-100 p-2 rounded">{error}</p>
        </div>
      )}

      {/* PHASES SUGGÉRÉES */}
      {perms.isAdmin && suggested.length > 0 && (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="flex items-center gap-2 text-indigo-800 font-semibold text-sm mb-2">
            <Sparkles className="w-4 h-4" /> {suggested.length} phase{suggested.length > 1 ? "s" : ""} détectée{suggested.length > 1 ? "s" : ""} dans des propales, absente{suggested.length > 1 ? "s" : ""} du catalogue
          </div>
          <div className="flex flex-wrap gap-2">
            {suggested.map((nom) => (
              <button key={nom} onClick={() => handleIntegrate(nom)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-indigo-200 text-indigo-700 rounded-full text-xs font-medium hover:bg-indigo-600 hover:text-white transition-colors">
                <Plus className="w-3 h-3" /> {nom}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* BARRE D'OUTILS */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher une phase…"
            className="w-full h-11 pl-9 pr-4 rounded-lg bg-white border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20" />
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-600 cursor-pointer">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="w-4 h-4 rounded border-zinc-300 text-[#00236f]" />
            Afficher les archivées
          </label>
          {perms.isAdmin && (
            <button onClick={handleAdd} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00236f] text-white text-sm font-bold hover:bg-[#1e3a8a]">
              <Plus className="w-4 h-4" /> Ajouter une phase
            </button>
          )}
        </div>
      </div>

      {/* LISTE DES PHASES */}
      <div className="space-y-4">
        {filtered.map((p) => {
          const net = netParPhase[p.nom]
          return (
            <div key={p.id} className={`bg-white rounded-xl border shadow-sm p-5 space-y-4 ${p.archived ? "border-zinc-300 opacity-70" : "border-zinc-200"}`}>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="w-7 h-7 rounded-full bg-[#00236f]/10 text-[#00236f] flex items-center justify-center font-bold text-sm shrink-0">{p.id}</span>
                <input value={p.nom} onChange={(e) => patch(p.id, "nom", e.target.value)}
                  className="font-bold text-lg text-zinc-800 flex-1 min-w-[180px] border-none bg-transparent focus:ring-0 p-0 outline-none" />
                {p.archived && <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-500 text-[10px] font-bold uppercase">Archivée</span>}
                {net !== undefined && (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200" title="Prix net moyen (hors marge & TVA) sur études signées">
                    Net effectif : {net.toLocaleString("fr-FR")} €
                  </span>
                )}
                <button onClick={() => handleSavePhase(p)} disabled={savingId === p.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[#00236f] text-white hover:bg-[#1e3a8a] disabled:opacity-50 shrink-0">
                  {savingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Enregistrer
                </button>
                {/* Archivage : super-admin uniquement */}
                {perms.isSuper && (
                  p.archived ? (
                    <button onClick={() => handleArchive(p, false)} className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50" title="Désarchiver">
                      <ArchiveRestore className="w-4 h-4" />
                    </button>
                  ) : (
                    <button onClick={() => setArchiveTarget(p)} className="p-2 rounded-lg text-red-500 hover:bg-red-50" title="Archiver">
                      <Archive className="w-4 h-4" />
                    </button>
                  )
                )}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <NumField label="JEH par défaut (€)" value={p.jeh_defaut} onChange={(v) => patch(p.id, "jeh_defaut", v)} />
                <NumField label="Intervenants moyen" value={p.intervenants_defaut} onChange={(v) => patch(p.id, "intervenants_defaut", v)} />
                <NumField label="Durée (semaines)" value={p.duree_semaines} onChange={(v) => patch(p.id, "duree_semaines", v)} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <TextArea label="Objectifs" value={p.objectifs ?? ""} onChange={(v) => patch(p.id, "objectifs", v)} />
                <TextArea label="Méthodologie" value={p.methodologie ?? ""} onChange={(v) => patch(p.id, "methodologie", v)} />
                <TextArea label="Contraintes" value={p.contraintes ?? ""} onChange={(v) => patch(p.id, "contraintes", v)} />
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && !error && <p className="text-center text-zinc-400 text-sm py-10">Aucune phase trouvée.</p>}
      </div>

      {/* TEXTES PAR DÉFAUT DES PROPOSITIONS (déplacé depuis l'admin) */}
      {perms.isAdmin && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 bg-zinc-50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-[#00236f]" />
              <h2 className="font-manrope font-bold text-[#00236f]">Textes par défaut des propositions</h2>
            </div>
            <button onClick={handleSaveContenu} disabled={savingContenu}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00236f] text-white text-xs font-bold hover:bg-[#1e3a8a] disabled:opacity-50">
              {savingContenu ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Enregistrer
            </button>
          </div>
          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            {CONTENU_FIELDS.map((f) => (
              <div key={f.key}>
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5 uppercase tracking-wide">{f.label}</label>
                <textarea value={contenu[f.key] ?? ""} onChange={(e) => setContenu((p) => ({ ...p, [f.key]: e.target.value }))} rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 resize-none" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODALE CONFIRMATION ARCHIVAGE */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100">
              <h2 className="font-manrope font-bold text-red-600 text-lg flex items-center gap-2"><Archive className="w-5 h-5" /> Archiver la phase</h2>
              <button onClick={() => setArchiveTarget(null)} className="text-zinc-400 hover:text-zinc-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-zinc-600">
                Êtes-vous sûr de vraiment vouloir archiver la phase <span className="font-semibold text-zinc-800">« {archiveTarget.nom} »</span> ?
              </p>
              <p className="text-xs text-zinc-400">
                Elle disparaîtra du générateur mais les études existantes qui l'utilisent ne seront pas impactées. Vous pourrez la désarchiver à tout moment.
              </p>
              <div className="flex justify-end gap-3 pt-1">
                <button onClick={() => setArchiveTarget(null)} className="px-4 py-2 text-sm text-zinc-600 hover:bg-zinc-100 rounded-lg">Annuler</button>
                <button onClick={() => handleArchive(archiveTarget, true)} className="px-5 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700">Archiver</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, accent, small }: { label: string; value: string | number; accent?: boolean; small?: boolean }) {
  return (
    <div className={`rounded-xl border shadow-sm p-4 ${accent ? "bg-[#00236f] border-[#00236f] text-white" : "bg-white border-zinc-200"}`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider ${accent ? "text-white/70" : "text-zinc-400"}`}>{label}</p>
      <p className={`font-manrope font-black ${small ? "text-sm mt-1 truncate" : "text-2xl"} ${accent ? "text-white" : "text-[#00236f]"}`} title={String(value)}>{value}</p>
    </div>
  )
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500 mb-1">{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-10 px-3 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20" />
    </div>
  )
}

function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wide text-zinc-500 mb-1">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={5}
        className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 resize-none" />
    </div>
  )
}
