"use client"

import { useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"

const DOCUMENTS = [
  { key: "carte_identite", label: "Carte d'identité", icon: "badge", required: true },
  { key: "carte_etudiante", label: "Carte étudiante", icon: "school", required: true },
  { key: "carte_vitale", label: "Carte vitale", icon: "health_and_safety", required: true },
  { key: "preuve_lydia", label: "Preuve Lydia", icon: "account_balance_wallet", required: false },
  { key: "rib", label: "RIB (Relevé d'Identité Bancaire)", icon: "account_balance", required: true },
]

interface DocState {
  status: "idle" | "uploading" | "done" | "error"
  fileName?: string
}

export default function DocumentsPage() {
  const [docStates, setDocStates] = useState<Record<string, DocState>>(
    Object.fromEntries(DOCUMENTS.map((d) => [d.key, { status: "idle" }]))
  )
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
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">
          Mon espace / Documents
        </p>
        <h1 className="text-2xl font-manrope font-black text-[#00236f]">Mes documents</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Déposez vos documents administratifs requis pour participer aux missions.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Documents list — col-span-8 */}
        <div className="lg:col-span-8 space-y-4">
          {/* Filigrane banner */}
          <div className="bg-[#00236f] rounded-xl p-5 flex flex-col sm:flex-row items-start gap-4 text-white">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white text-2xl">verified_user</span>
            </div>
            <div className="flex-1">
              <h3 className="font-manrope font-bold text-base mb-1">
                Sécurisez vos documents avec le filigrane officiel
              </h3>
              <p className="text-blue-200 text-sm mb-3">
                Avant de déposer vos pièces d'identité, nous recommandons d'ajouter un filigrane
                via le service officiel de l'État.
              </p>
              <a
                href="https://www.service-public.fr/particuliers/vosdroits/R61460"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-[#00236f] text-sm font-semibold hover:bg-blue-50 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">open_in_new</span>
                Ajouter un filigrane (service-public.fr)
              </a>
            </div>
          </div>

          {/* Document upload slots */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-manrope font-bold text-[#00236f] text-base">Mes pièces justificatives</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {DOCUMENTS.map((doc) => {
                const state = docStates[doc.key]
                return (
                  <div
                    key={doc.key}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 cursor-pointer transition-colors group"
                    onClick={() => fileInputRefs.current[doc.key]?.click()}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      state.status === "done" ? "bg-emerald-100"
                      : state.status === "error" ? "bg-red-100"
                      : "bg-slate-100 group-hover:bg-[#d0d8ff]"
                    }`}>
                      <span className={`material-symbols-outlined text-xl ${
                        state.status === "done" ? "text-emerald-600"
                        : state.status === "error" ? "text-red-500"
                        : "text-slate-500 group-hover:text-[#00236f]"
                      }`}>
                        {state.status === "done" ? "check_circle" : state.status === "error" ? "error" : doc.icon}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{doc.label}</p>
                      <p className="text-xs text-slate-400">
                        {state.fileName || (doc.required ? "Requis · PDF, JPG, PNG" : "Optionnel · PDF, JPG, PNG")}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {state.status === "idle" && (
                        <span className="material-symbols-outlined text-slate-300 group-hover:text-[#00236f] text-xl transition-colors">cloud_upload</span>
                      )}
                      {state.status === "uploading" && (
                        <span className="material-symbols-outlined text-[#00236f] text-xl animate-spin">autorenew</span>
                      )}
                      {state.status === "done" && (
                        <span className="material-symbols-outlined text-emerald-500 text-xl">check_circle</span>
                      )}
                      {state.status === "error" && (
                        <span className="material-symbols-outlined text-red-500 text-xl">error</span>
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
        </div>

        {/* Right column — col-span-4 */}
        <div className="lg:col-span-4 space-y-4">
          {/* Progress */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-manrope font-bold text-[#00236f] text-base mb-4">Progression</h2>
            <div className="space-y-2">
              {DOCUMENTS.map((doc) => {
                const state = docStates[doc.key]
                return (
                  <div key={doc.key} className="flex items-center gap-3">
                    <span className={`material-symbols-outlined text-lg ${
                      state.status === "done" ? "text-emerald-500" : "text-slate-300"
                    }`}>
                      {state.status === "done" ? "check_circle" : "radio_button_unchecked"}
                    </span>
                    <span className={`text-sm ${state.status === "done" ? "text-slate-800 font-medium" : "text-slate-400"}`}>
                      {doc.label}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                <span>Complétude</span>
                <span className="font-bold text-[#00236f]">
                  {Object.values(docStates).filter((s) => s.status === "done").length}/{DOCUMENTS.length}
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#00236f] rounded-full transition-all"
                  style={{
                    width: `${(Object.values(docStates).filter((s) => s.status === "done").length / DOCUMENTS.length) * 100}%`
                  }}
                />
              </div>
            </div>
          </div>

          {/* Security notice */}
          <div className="bg-[#00236f] rounded-xl p-5 text-white">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[#d0d8ff] text-2xl shrink-0">shield</span>
              <div>
                <p className="font-manrope font-bold text-sm mb-1">Stockage sécurisé</p>
                <p className="text-xs text-blue-200 leading-relaxed">
                  Chiffrement AES-256. Conformité RGPD. Accès réservé aux administrateurs habilités dans le cadre du traitement de vos missions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
