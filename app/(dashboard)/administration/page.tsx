"use client"

import { useState } from "react"
import { Building2, Save, FileSignature, MapPin, Receipt, Wallet } from "lucide-react"

export default function StructureSettingsPage() {
  const [structureForm, setStructureForm] = useState({
    raison_sociale: "BeFast Junior Conseil",
    siret: "123 456 789 00012",
    code_ape: "7022Z",
    tva_intracom: "FR 12 123456789",
    urssaf: "1234567",
    
    adresse: "8 Route de la Jonelière",
    code_postal: "44300",
    ville: "Nantes",
    email_contact: "contact@befast-jc.com",
    tel_contact: "02 40 37 34 34",
    
    presidence_titre: "Monsieur",
    presidence_nom: "Dupont",
    presidence_prenom: "Jean",
    tresorerie_titre: "Madame",
    tresorerie_nom: "Martin",
    tresorerie_prenom: "Alice",

    iban: "FR76 1234 5678 9012 3456 7890 123",
    bic: "XXXXFRYY",
    frais_dossier: "50",
    tjh_moyen: "400"
  })

  const handleChange = (field: string, val: string) =>
    setStructureForm((prev) => ({ ...prev, [field]: val }))

  return (
    <div className="p-8 h-full overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Paramètres de la Structure</h1>
          <p className="text-slate-500 text-sm mt-1">Configurez les informations légales et administratives de votre Junior.</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-all shadow-sm">
          <Save className="w-4 h-4" />
          Enregistrer
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-8">
        
        {/* LÉGAL & IDENTITÉ */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <Building2 className="w-5 h-5 text-[#00236f]" />
            <h2 className="font-bold text-slate-800">Identité Légale</h2>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Raison Sociale</label>
              <input
                type="text"
                value={structureForm.raison_sociale}
                onChange={(e) => handleChange("raison_sociale", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 focus:border-[#00236f] transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Numéro SIRET</label>
              <input
                type="text"
                value={structureForm.siret}
                onChange={(e) => handleChange("siret", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Code APE</label>
              <input
                type="text"
                value={structureForm.code_ape}
                onChange={(e) => handleChange("code_ape", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Numéro TVA</label>
              <input
                type="text"
                value={structureForm.tva_intracom}
                onChange={(e) => handleChange("tva_intracom", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Numéro URSSAF</label>
              <input
                type="text"
                value={structureForm.urssaf}
                onChange={(e) => handleChange("urssaf", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all"
              />
            </div>
          </div>
        </div>

        {/* COORDONNÉES */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <MapPin className="w-5 h-5 text-[#00236f]" />
            <h2 className="font-bold text-slate-800">Coordonnées</h2>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Adresse du Siège</label>
              <input
                type="text"
                value={structureForm.adresse}
                onChange={(e) => handleChange("adresse", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Code Postal</label>
              <input
                type="text"
                value={structureForm.code_postal}
                onChange={(e) => handleChange("code_postal", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Ville</label>
              <input
                type="text"
                value={structureForm.ville}
                onChange={(e) => handleChange("ville", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Email de Contact</label>
              <input
                type="email"
                value={structureForm.email_contact}
                onChange={(e) => handleChange("email_contact", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Téléphone</label>
              <input
                type="tel"
                value={structureForm.tel_contact}
                onChange={(e) => handleChange("tel_contact", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all"
              />
            </div>
          </div>
        </div>

        {/* ORGANIGRAMME DU MANDAT */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <FileSignature className="w-5 h-5 text-[#00236f]" />
            <h2 className="font-bold text-slate-800">Organigramme du Mandat (Signataires)</h2>
          </div>
          <div className="p-5 space-y-6">
            
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#00236f]">Présidence</h3>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Titre</label>
                  <select
                    value={structureForm.presidence_titre}
                    onChange={(e) => handleChange("presidence_titre", e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all"
                  >
                    <option value="Monsieur">Monsieur</option>
                    <option value="Madame">Madame</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Nom</label>
                  <input
                    type="text"
                    value={structureForm.presidence_nom}
                    onChange={(e) => handleChange("presidence_nom", e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Prénom</label>
                  <input
                    type="text"
                    value={structureForm.presidence_prenom}
                    onChange={(e) => handleChange("presidence_prenom", e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm"
                  />
                </div>
              </div>
            </div>

            <hr className="border-slate-100" />

            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-[#00236f]">Trésorerie</h3>
              <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Titre</label>
                  <select
                    value={structureForm.tresorerie_titre}
                    onChange={(e) => handleChange("tresorerie_titre", e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all"
                  >
                    <option value="Monsieur">Monsieur</option>
                    <option value="Madame">Madame</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Nom</label>
                  <input
                    type="text"
                    value={structureForm.tresorerie_nom}
                    onChange={(e) => handleChange("tresorerie_nom", e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1.5">Prénom</label>
                  <input
                    type="text"
                    value={structureForm.tresorerie_prenom}
                    onChange={(e) => handleChange("tresorerie_prenom", e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm"
                  />
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* DONNÉES FI */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="bg-slate-50 px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <Wallet className="w-5 h-5 text-[#00236f]" />
            <h2 className="font-bold text-slate-800">Données Financières</h2>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">IBAN</label>
              <input
                type="text"
                value={structureForm.iban}
                onChange={(e) => handleChange("iban", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">BIC</label>
              <input
                type="text"
                value={structureForm.bic}
                onChange={(e) => handleChange("bic", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all"
              />
            </div>
            
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Frais de Dossier (€)</label>
              <div className="relative">
                <Receipt className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                <input
                  type="number"
                  value={structureForm.frais_dossier}
                  onChange={(e) => handleChange("frais_dossier", e.target.value)}
                  className="w-full h-10 pl-10 pr-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">TJH Moyen Visé (€)</label>
              <div className="relative">
                <Receipt className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                <input
                  type="number"
                  value={structureForm.tjh_moyen}
                  onChange={(e) => handleChange("tjh_moyen", e.target.value)}
                  className="w-full h-10 pl-10 pr-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 transition-all"
                />
              </div>
            </div>
            
          </div>
        </div>

      </div>
    </div>
  )
}
