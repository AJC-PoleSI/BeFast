"use client"

import { useState, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  CheckCircle2,
  Upload,
  ExternalLink,
  ShieldCheck,
  FileText,
  CreditCard,
  GraduationCap,
  Heart,
  Wallet,
  Loader2,
  AlertCircle,
} from "lucide-react"

const DOCUMENTS = [
  { key: "carte_identite", label: "Carte d'identité", icon: CreditCard, required: true },
  { key: "carte_etudiante", label: "Carte étudiante", icon: GraduationCap, required: true },
  { key: "carte_vitale", label: "Carte vitale", icon: Heart, required: true },
  { key: "rib", label: "RIB (Relevé d'Identité Bancaire)", icon: Wallet, required: true },
  { key: "autre", label: "Autre document", icon: FileText, required: false },
]

interface DocState {
  status: "idle" | "uploading" | "done" | "error"
  fileName?: string
  url?: string
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
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) throw new Error("Non authentifié")

      const ext = file.name.split(".").pop()
      const path = `${user.id}/${docKey}.${ext}`

      const { error } = await supabase.storage
        .from("documents-personnes")
        .upload(path, file, { upsert: true })

      if (error) throw error

      setDocStates((prev) => ({
        ...prev,
        [docKey]: { status: "done", fileName: file.name },
      }))
    } catch (err) {
      setDocStates((prev) => ({
        ...prev,
        [docKey]: { status: "error", fileName: file.name },
      }))
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-4 text-[#0D1B2A] font-bold text-sm tracking-widest uppercase">
          <div className="h-[1px] w-8 bg-[#0D1B2A]/30" />
          Mon espace
        </div>
        <h1 className="text-4xl font-extrabold text-[#0D1B2A] tracking-tight font-headline">
          Mes documents
        </h1>
        <p className="text-slate-500 text-sm max-w-xl">
          Déposez vos documents administratifs requis pour participer aux missions.
          Tous les fichiers sont chiffrés et stockés de manière sécurisée.
        </p>
      </div>

      {/* Filigrane Banner */}
      <Card className="p-6 bg-[#0D1B2A] text-white border-0">
        <div className="flex items-start gap-4">
          <ShieldCheck className="w-8 h-8 text-[#C9A84C] shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">Sécurisez vos documents avec le filigrane officiel</h3>
            <p className="text-slate-300 text-sm mb-4">
              Avant de déposer vos pièces d'identité, nous recommandons d'ajouter un filigrane
              via le service officiel de l'État pour protéger vos documents contre la fraude.
            </p>
            <Button
              asChild
              className="bg-[#C9A84C] hover:bg-[#C9A84C]/90 text-[#0D1B2A] font-bold gap-2"
            >
              <a
                href="https://www.service-public.fr/particuliers/vosdroits/R61460"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4" />
                Ajouter un filigrane (service-public.fr)
              </a>
            </Button>
          </div>
        </div>
      </Card>

      {/* Documents List */}
      <div className="space-y-3">
        {DOCUMENTS.map((doc) => {
          const Icon = doc.icon
          const state = docStates[doc.key]

          return (
            <Card
              key={doc.key}
              className="p-5 flex items-center justify-between gap-4 hover:border-[#C9A84C]/40 transition-colors cursor-pointer group"
              onClick={() => fileInputRefs.current[doc.key]?.click()}
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                  state.status === "done"
                    ? "bg-green-100"
                    : state.status === "error"
                    ? "bg-red-100"
                    : "bg-slate-100 group-hover:bg-[#0D1B2A]/10"
                }`}>
                  <Icon className={`w-5 h-5 ${
                    state.status === "done"
                      ? "text-green-600"
                      : state.status === "error"
                      ? "text-red-500"
                      : "text-slate-500 group-hover:text-[#0D1B2A]"
                  }`} />
                </div>

                <div className="min-w-0">
                  <p className="font-semibold text-[#0D1B2A] text-sm">{doc.label}</p>
                  {state.fileName && (
                    <p className="text-xs text-slate-500 truncate">{state.fileName}</p>
                  )}
                  {!state.fileName && (
                    <p className="text-xs text-slate-400">
                      {doc.required ? "Requis" : "Optionnel"} · PDF, JPG, PNG
                    </p>
                  )}
                </div>
              </div>

              {/* Status indicator */}
              <div className="shrink-0">
                {state.status === "idle" && (
                  <Upload className="w-5 h-5 text-slate-400 group-hover:text-[#0D1B2A] transition-colors" />
                )}
                {state.status === "uploading" && (
                  <Loader2 className="w-5 h-5 text-[#C9A84C] animate-spin" />
                )}
                {state.status === "done" && (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
                {state.status === "error" && (
                  <AlertCircle className="w-5 h-5 text-red-500" />
                )}
              </div>

              {/* Hidden file input */}
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
            </Card>
          )
        })}
      </div>

      {/* RGPD Notice */}
      <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <ShieldCheck className="w-5 h-5 text-[#0D1B2A] shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 leading-relaxed">
          Vos documents sont chiffrés (AES-256) et stockés sur des serveurs sécurisés
          conformes au RGPD. Seuls les administrateurs habilités peuvent y accéder dans
          le cadre du traitement de vos missions.
        </p>
      </div>
    </div>
  )
}
