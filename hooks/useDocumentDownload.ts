"use client"

import { useState } from "react"
import { toast } from "sonner"

type GenerateParams = {
  template_id: string
  scope: "etude" | "mission" | "personne" | "general"
  entity_id: string
  intervenant_id?: string
}

export function useDocumentDownload() {
  const [generating, setGenerating] = useState(false)

  async function generate(params: GenerateParams): Promise<boolean> {
    setGenerating(true)
    try {
      const res = await fetch("/api/documents/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json?.error || "Erreur lors de la génération")
        return false
      }
      window.open(`/api/documents/${json.data.id}/download`, "_blank")
      toast.success("Document généré")
      return true
    } catch {
      toast.error("Erreur réseau")
      return false
    } finally {
      setGenerating(false)
    }
  }

  return { generate, generating }
}
