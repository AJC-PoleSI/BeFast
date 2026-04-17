"use client"

import { FileText, Plus, Search } from "lucide-react"

export default function DocumentTemplatesPage() {
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Modèles de Documents</h1>
          <p className="text-slate-500 text-sm mt-1">Gérez les modèles de documents (contrats, factures, etc.) de votre structure.</p>
        </div>
        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-all shadow-sm">
          <Plus className="w-4 h-4" />
          Nouveau Modèle
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
          <FileText className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-semibold text-slate-800 mb-2">Aucun modèle configuré</h3>
        <p className="text-slate-500 max-w-sm mx-auto">
          Les modèles de documents permettent de générer automatiquement vos contrats et factures.
        </p>
      </div>
    </div>
  )
}
