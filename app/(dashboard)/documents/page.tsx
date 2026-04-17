"use client"

import { Shield } from "lucide-react"
import { DocumentsGrid } from "@/app/(dashboard)/dashboard/profil/_components/DocumentsGrid"

export default function DocumentsPage() {
  return (
    <div className="max-w-xl mx-auto py-8 space-y-6">
      
      {/* CARD MES DOCUMENTS */}
      <div className="bg-white rounded-3xl overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
        <DocumentsGrid />
      </div>

      {/* CARD PROTECTION DES DONNEES */}
      <div className="bg-[#e4ebf5] rounded-3xl p-8 flex items-start gap-4">
        <Shield className="w-6 h-6 text-[#0f2142] shrink-0 mt-1" />
        <div>
          <h2 className="text-[#0f2142] font-bold text-lg mb-2">Protection des données</h2>
          <p className="text-[#4b6a9e] text-sm font-medium leading-relaxed">
            Vos documents sont chiffrés et stockés sur des serveurs sécurisés conformes RGPD.
          </p>
        </div>
      </div>

    </div>
  )
}
