"use client"

import { useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { ShieldCheck, CloudUpload, FileText, CheckCircle2, Shield } from "lucide-react"

const DOCUMENTS = [
  { key: "carte_identite", label: "Carte d'identité", required: true },
  { key: "carte_etudiante", label: "Carte d'étudiant", required: true },
  { key: "carte_vitale", label: "Carte vitale", required: true },
  { key: "preuve_lydia", label: "Preuve Lydia", required: false },
  { key: "rib", label: "RIB (Relevé d'Identité)", required: true },
]

interface DocState {
  status: "idle" | "uploading" | "done" | "error"
  fileName?: string
}

export default function DocumentsPage() {
  const [docStates, setDocStates] = useState<Record<string, DocState>>({
    carte_identite: { status: "done", fileName: "cni.pdf" },
    carte_etudiante: { status: "done", fileName: "etu.pdf" },
    carte_vitale: { status: "idle" },
    preuve_lydia: { status: "idle" },
    rib: { status: "idle" },
  })
  
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  async function handleUpload(docKey: string, file: File) {
    setDocStates((prev) => ({ ...prev, [docKey]: { status: "uploading" } }))
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Non authentifié")
      const ext = file.name.split(".").pop()
      const path = `${user.id}/${docKey}.${ext}`
      const { error } = await supabase.storage
        .from("documents-personnes")
        .upload(path, file, { upsert: true })
      if (error) throw error
      setDocStates((prev) => ({ ...prev, [docKey]: { status: "done", fileName: file.name } }))
    } catch {
      setDocStates((prev) => ({ ...prev, [docKey]: { status: "error", fileName: file.name } }))
    }
  }

  return (
    <div className="max-w-md mx-auto py-8">
      
      {/* CARD MES DOCUMENTS */}
      <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mb-6">
        
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-6 h-6 text-[#0f2142]" />
          <h1 className="text-2xl font-bold text-[#0f2142]">Mes documents</h1>
        </div>
        <p className="text-slate-500 mb-8 font-medium">
          Documents administratifs requis pour vos missions.
        </p>

        {/* BANNANER FILIGRANE */}
        <div className="flex flex-col items-center mb-8">
          <a 
            href="https://filigrane.beta.gouv.fr/"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-4 bg-[#1f3b89] hover:bg-[#162d6b] transition-colors text-white rounded-xl py-4 px-6 shadow-md"
          >
            <ShieldCheck className="w-6 h-6 shrink-0" />
            <span className="font-bold text-center text-[15px]">
              Ajouter un filigrane<br />(Filigrane.gouv.fr)
            </span>
          </a>
          <p className="text-[11px] italic text-slate-400 mt-3 font-medium">
            Sécurisez vos documents avant l'envoi
          </p>
        </div>

        {/* LISTE DES DOCUMENTS */}
        <div className="space-y-4">
          {DOCUMENTS.map((doc) => {
            const state = docStates[doc.key]
            return (
              <div
                key={doc.key}
                onClick={() => fileInputRefs.current[doc.key]?.click()}
                className="flex items-center justify-between p-4 rounded-2xl border-2 border-dashed border-slate-200 hover:border-slate-300 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 border border-slate-100">
                    <FileText className="w-4 h-4 text-slate-400" />
                  </div>
                  <span className="font-semibold text-slate-800">{doc.label}</span>
                </div>

                <div>
                  {state.status === "idle" && (
                    <CloudUpload className="w-5 h-5 text-[#3b66d4]" />
                  )}
                  {state.status === "uploading" && (
                    <span className="material-symbols-outlined w-5 h-5 text-[#3b66d4] animate-spin">autorenew</span>
                  )}
                  {state.status === "done" && (
                    <CheckCircle2 className="w-6 h-6 text-[#10b981]" fill="#10b981" color="white" />
                  )}
                  {state.status === "error" && (
                    <span className="material-symbols-outlined w-5 h-5 text-red-500">error</span>
                  )}
                </div>

                <input
                  ref={(el) => { fileInputRefs.current[doc.key] = el }}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(doc.key, file)
                  }}
                />
              </div>
            )
          })}
        </div>
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
