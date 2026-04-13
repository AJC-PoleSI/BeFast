"use client"

import { useState, useRef, useCallback } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

interface AvatarUploadProps {
  avatarUrl: string | null
  prenom: string | null
  nom: string | null
  onUpdate: (url: string) => void
}

export function AvatarUpload({ avatarUrl, prenom, nom, onUpdate }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(avatarUrl)
  const inputRef = useRef<HTMLInputElement>(null)

  const initials = [prenom?.[0], nom?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "?"

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (file.size > 2 * 1024 * 1024) {
        toast.error("L'image ne doit pas dépasser 2 Mo")
        return
      }

      // Show preview immediately
      const reader = new FileReader()
      reader.onload = (ev) => setPreviewUrl(ev.target?.result as string)
      reader.readAsDataURL(file)

      setUploading(true)
      try {
        const formData = new FormData()
        formData.append("file", file)

        const res = await fetch("/api/profil/avatar", {
          method: "POST",
          body: formData,
        })

        const data = await res.json()
        if (!res.ok) {
          toast.error(data.error || "Erreur lors de l'upload. Veuillez reessayer.")
          setPreviewUrl(avatarUrl)
          return
        }

        toast.success("Photo de profil mise a jour.")
        setPreviewUrl(data.url)
        onUpdate(data.url)
      } catch {
        toast.error("Erreur lors de l'upload. Veuillez reessayer.")
        setPreviewUrl(avatarUrl)
      } finally {
        setUploading(false)
        e.target.value = ""
      }
    },
    [avatarUrl, onUpdate]
  )

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <Avatar className="h-20 w-20">
          <AvatarImage src={previewUrl || undefined} alt="Avatar" />
          <AvatarFallback className="bg-[#C9A84C] text-[#0D1B2A] text-xl font-bold">
            {uploading ? <Loader2 className="h-6 w-6 animate-spin" /> : initials}
          </AvatarFallback>
        </Avatar>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-sm text-[#4A90D9] cursor-pointer hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Changer la photo
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  )
}
