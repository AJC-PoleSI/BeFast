"use client"

import { useState } from "react"

const SOURCE_DATA = [
  { label: "Appels d'Offres", pct: 45, color: "bg-[#00236f]" },
  { label: "Clients Sortants", pct: 30, color: "bg-[#1e3a8a]" },
  { label: "Prospection Directe", pct: 25, color: "bg-[#d0d8ff]" },
]

export default function AdministrationPage() {
  const [structureForm, setStructureForm] = useState({
    raison_sociale: "",
    numero_mission: "",
    iban: "",
    siret: "",
    code_ape: "",
    presidence: "",
    urssaf: "",
  })

  const handleChange = (field: string, val: string) =>
    setStructureForm((prev) => ({ ...prev, [field]: val }))

  return (
    <div className="space-y-6">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-[#00236f] to-[#1e3a8a] rounded-2xl p-7 text-white">
        <p className="text-xs font-medium text-blue-200 uppercase tracking-widest mb-2">
          Strategic Center / Admin Console
        </p>
        <h1 className="text-2xl font-manrope font-black mb-1">Administration</h1>
        <p className="text-blue-200 text-sm">Console d'administration et paramètres de structure</p>
      </div>

      {/* KPI stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">CA Réalisé vs Prévisionnel</p>
          <div className="flex items-end gap-4">
            <div>
              <p className="text-2xl font-manrope font-black text-[#00236f]">—</p>
              <p className="text-xs text-slate-400 mt-0.5">Réalisé</p>
            </div>
            <div className="text-slate-200 text-2xl pb-1">/</div>
            <div>
              <p className="text-2xl font-manrope font-black text-slate-400">—</p>
              <p className="text-xs text-slate-400 mt-0.5">Prévisionnel</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Missions</p>
          <p className="text-2xl font-manrope font-black text-[#00236f]">—</p>
          <p className="text-xs text-slate-400 mt-0.5">En cours</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Intervenants</p>
          <p className="text-2xl font-manrope font-black text-[#00236f]">—</p>
          <p className="text-xs text-slate-400 mt-0.5">Actifs</p>
        </div>
      </div>

      {/* Main 2-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col — span-2 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Structure settings form */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
              <span className="material-symbols-outlined text-[#00236f] text-xl">business</span>
              <h2 className="font-manrope font-bold text-[#00236f] text-base">Paramètres de la structure</h2>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { field: "raison_sociale", label: "Raison sociale" },
                { field: "numero_mission", label: "Numéro mission" },
                { field: "iban", label: "IBAN" },
                { field: "siret", label: "SIRET" },
                { field: "code_ape", label: "Code APE" },
                { field: "presidence", label: "Présidence" },
                { field: "urssaf", label: "URSSAF" },
              ].map(({ field, label }) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">{label}</label>
                  <input
                    type="text"
                    value={structureForm[field as keyof typeof structureForm]}
                    onChange={(e) => handleChange(field, e.target.value)}
                    placeholder="—"
                    className="w-full h-9 px-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20"
                  />
                </div>
              ))}
            </div>
            <div className="px-6 pb-5 flex justify-end">
              <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors">
                <span className="material-symbols-outlined text-lg">save</span>
                Enregistrer
              </button>
            </div>
          </div>

          {/* Access rights matrix */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
              <span className="material-symbols-outlined text-[#00236f] text-xl">admin_panel_settings</span>
              <h2 className="font-manrope font-bold text-[#00236f] text-base">Gestion des droits d'accès</h2>
            </div>
            <div className="p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-semibold text-slate-500 pb-3 pr-4">Module</th>
                    <th className="text-center text-xs font-semibold text-slate-500 pb-3 px-3">Intervenant</th>
                    <th className="text-center text-xs font-semibold text-slate-500 pb-3 px-3">Chef de Projet</th>
                    <th className="text-center text-xs font-semibold text-slate-500 pb-3 px-3">Administrateur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {[
                    { module: "Dashboard", intervenant: true, chef: true, admin: true },
                    { module: "Profil", intervenant: true, chef: true, admin: true },
                    { module: "Missions", intervenant: true, chef: true, admin: true },
                    { module: "Documents", intervenant: true, chef: true, admin: true },
                    { module: "Études", intervenant: false, chef: true, admin: true },
                    { module: "Prospection", intervenant: false, chef: true, admin: true },
                    { module: "Administration", intervenant: false, chef: false, admin: true },
                    { module: "Nouvelle mission", intervenant: false, chef: true, admin: true },
                  ].map((row) => (
                    <tr key={row.module} className="hover:bg-slate-50">
                      <td className="py-3 pr-4 font-medium text-slate-700">{row.module}</td>
                      {[row.intervenant, row.chef, row.admin].map((allowed, i) => (
                        <td key={i} className="py-3 px-3 text-center">
                          <span className={`material-symbols-outlined text-lg ${allowed ? "text-emerald-500" : "text-slate-200"}`}>
                            {allowed ? "check_circle" : "cancel"}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Audit log */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100">
              <span className="material-symbols-outlined text-[#00236f] text-xl">history</span>
              <h2 className="font-manrope font-bold text-[#00236f] text-base">Journal d'audit</h2>
            </div>
            <div className="p-6">
              <div className="flex flex-col items-center justify-center py-8 text-slate-300">
                <span className="material-symbols-outlined text-5xl mb-2">receipt_long</span>
                <p className="text-sm text-slate-400">Aucun événement récent</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right col — span-1 */}
        <div className="space-y-4">
          {/* Sources chart */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-manrope font-bold text-[#00236f] text-base mb-4">Sources des Études</h2>
            <div className="space-y-3">
              {SOURCE_DATA.map((src) => (
                <div key={src.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-slate-600">{src.label}</span>
                    <span className="text-xs font-bold text-[#00236f]">{src.pct}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${src.color}`}
                      style={{ width: `${src.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Import/Export dark card */}
          <div className="bg-[#00236f] rounded-xl p-5 text-white">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-[#d0d8ff] text-xl">import_export</span>
              <h2 className="font-manrope font-bold text-base">Import / Export</h2>
            </div>
            <div className="space-y-2 mb-4">
              {[
                { label: "Rapport mensuel", icon: "table_chart" },
                { label: "Liste des membres", icon: "group" },
                { label: "Études actives", icon: "school" },
              ].map((item) => (
                <button
                  key={item.label}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-[#d0d8ff] text-lg">{item.icon}</span>
                  <span className="text-sm font-medium">{item.label}</span>
                  <span className="material-symbols-outlined text-blue-300 text-base ml-auto">download</span>
                </button>
              ))}
            </div>

            {/* Drag-drop zone */}
            <div className="border-2 border-dashed border-white/20 rounded-xl p-4 text-center hover:border-white/40 transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-[#d0d8ff] text-3xl mb-1 block">cloud_upload</span>
              <p className="text-xs text-blue-200">Glissez un fichier ici pour l'importer</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
