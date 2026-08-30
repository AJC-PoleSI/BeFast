"use client"

import { useEffect, useState } from "react"
import { getClientsFull, createClient_ as addClient, updateClient_ as saveClient } from "@/lib/actions/etudes"
import { Skeleton } from "@/components/ui/skeleton"
import { Pencil, Plus, Search, X } from "lucide-react"
import type { Client } from "@/types/database.types"

const EMPTY_FORM = {
  nom: "", secteur: "", type: "", contact_civilite: "", contact_prenom: "", contact_nom: "",
  contact_poste: "", contact_email: "", contact_phone: "", adresse: "", code_postal: "", ville: "",
}

export default function ProspectionClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await getClientsFull()
    if ((res as any).data) setClients((res as any).data as Client[])
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = clients.filter((c) => {
    const q = searchTerm.toLowerCase()
    return (
      c.nom.toLowerCase().includes(q) ||
      (c.secteur ?? "").toLowerCase().includes(q) ||
      (c.contact_nom ?? "").toLowerCase().includes(q) ||
      (c.ville ?? "").toLowerCase().includes(q)
    )
  })

  const openCreate = () => {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setShowModal(true)
  }

  const openEdit = (c: Client) => {
    setEditingId(c.id)
    setForm({
      nom: c.nom ?? "",
      secteur: c.secteur ?? "",
      type: c.type ?? "",
      contact_civilite: c.contact_civilite ?? "",
      contact_prenom: c.contact_prenom ?? "",
      contact_nom: c.contact_nom ?? "",
      contact_poste: c.contact_poste ?? "",
      contact_email: c.contact_email ?? "",
      contact_phone: c.contact_phone ?? "",
      adresse: c.adresse ?? "",
      code_postal: c.code_postal ?? "",
      ville: c.ville ?? "",
    })
    setFormError(null)
    setShowModal(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    const payload = {
      nom: form.nom,
      secteur: form.secteur || undefined,
      type: form.type || undefined,
      contact_civilite: form.contact_civilite || undefined,
      contact_prenom: form.contact_prenom || undefined,
      contact_nom: form.contact_nom || undefined,
      contact_poste: form.contact_poste || undefined,
      contact_email: form.contact_email || undefined,
      contact_phone: form.contact_phone || undefined,
      adresse: form.adresse || undefined,
      code_postal: form.code_postal || undefined,
      ville: form.ville || undefined,
    }
    const result = editingId ? await saveClient(editingId, payload) : await addClient(payload)
    setSubmitting(false)
    if ((result as any).error) { setFormError((result as any).error); return }
    setShowModal(false)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-1">Prospection</p>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Clients &amp; prospects</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Consultez et gérez les clients et prospects, sans passer par la création d&apos;une étude ou d&apos;une mission.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-[#00236f] hover:bg-[#00174a] text-white px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm shrink-0"
        >
          <Plus className="h-4 w-4" /> Nouveau client
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Rechercher un client, un secteur, une ville..."
          className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
          <Skeleton className="h-14 w-full rounded-xl" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-3">Nom</th>
                  <th className="px-6 py-3">Secteur</th>
                  <th className="px-6 py-3">Interlocuteur</th>
                  <th className="px-6 py-3">Ville</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-3 font-semibold text-slate-800">{c.nom}</td>
                    <td className="px-6 py-3 text-slate-500">{c.secteur || "—"}</td>
                    <td className="px-6 py-3 text-slate-500">
                      {[c.contact_prenom, c.contact_nom].filter(Boolean).join(" ") || "—"}
                      {c.contact_email && <span className="block text-xs text-slate-400">{c.contact_email}</span>}
                    </td>
                    <td className="px-6 py-3 text-slate-500">{c.ville || "—"}</td>
                    <td className="px-6 py-3 text-right">
                      <button
                        onClick={() => openEdit(c)}
                        className="p-2 text-slate-500 hover:text-[#00236f] hover:bg-[#d0d8ff]/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        title="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Aucun client ne correspond à cette recherche.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowModal(false)}
        >
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between p-5 border-b border-zinc-100">
              <h2 className="font-manrope font-bold text-[#00236f]">
                {editingId ? "Modifier le client" : "Nouveau client"}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Nom du client *</label>
                  <input
                    required
                    value={form.nom}
                    onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                    placeholder="Ex : Danone"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Secteur</label>
                  <input
                    value={form.secteur}
                    onChange={(e) => setForm((f) => ({ ...f, secteur: e.target.value }))}
                    placeholder="Ex : Agroalimentaire"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  >
                    <option value="">—</option>
                    <option value="ao">AO</option>
                    <option value="cs">CS</option>
                    <option value="prospection">Prospection</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Adresse</label>
                  <input
                    value={form.adresse}
                    onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Code postal</label>
                  <input
                    value={form.code_postal}
                    onChange={(e) => setForm((f) => ({ ...f, code_postal: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Ville</label>
                  <input
                    value={form.ville}
                    onChange={(e) => setForm((f) => ({ ...f, ville: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                </div>
                <p className="col-span-2 text-[11px] font-semibold text-zinc-500 pt-1">Interlocuteur (pour les documents)</p>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Civilité</label>
                  <select
                    value={form.contact_civilite}
                    onChange={(e) => setForm((f) => ({ ...f, contact_civilite: e.target.value }))}
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
                    value={form.contact_poste}
                    onChange={(e) => setForm((f) => ({ ...f, contact_poste: e.target.value }))}
                    placeholder="Ex : Directeur marketing"
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Prénom</label>
                  <input
                    value={form.contact_prenom}
                    onChange={(e) => setForm((f) => ({ ...f, contact_prenom: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Nom</label>
                  <input
                    value={form.contact_nom}
                    onChange={(e) => setForm((f) => ({ ...f, contact_nom: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Téléphone</label>
                  <input
                    value={form.contact_phone}
                    onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                    className="w-full px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                </div>
              </div>
              {formError && <p className="text-xs text-red-500 font-medium">{formError}</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-zinc-100">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-50 rounded-lg"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-semibold text-white bg-[#00236f] rounded-lg hover:bg-[#00236f]/90 disabled:opacity-50"
              >
                {submitting ? "Enregistrement..." : editingId ? "Enregistrer" : "Créer le client"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
