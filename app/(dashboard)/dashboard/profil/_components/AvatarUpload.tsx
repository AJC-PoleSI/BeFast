"use client"

import { useState, useRef, useCallback } from "react"
import { Camera, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"

interface AvatarUploadProps {
  currentUrl: string | null
  initials: string
  onUploaded?: (url: string) => void
}

export function AvatarUpload({
  currentUrl,
  initials,
  onUploaded,
}: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      if (!file.type.startsWith("image/")) {
        toast.error("Le fichier doit être une image")
        return
      }
      if (file.size > 2 * 1024 * 1024) {
        toast.error("L'image ne doit pas dépasser 2 Mo")
        return
      }

      // Preview
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
          toast.error(data.error || "Erreur lors de l'upload")
          setPreviewUrl(currentUrl)
          return
        }

        toast.success("Photo de profil mise à jour")
        setPreviewUrl(data.url)
        onUploaded?.(data.url)
      } catch {
        toast.error("Erreur réseau")
        setPreviewUrl(currentUrl)
      } finally {
        setUploading(false)
      }
    },
    [currentUrl, onUploaded]
  )

  return (
    <div className="relative group">
      <Avatar className="h-24 w-24 ring-4 ring-white shadow-lg transition-transform group-hover:scale-105">
        <AvatarImage src={previewUrl || undefined} alt="Avatar" />
        <AvatarFallback className="bg-gold text-navy text-2xl font-bold">
          {initials}
        </AvatarFallback>
      </Avatar>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 group-hover:bg-black/40 transition-all cursor-pointer"
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 text-white animate-spin" />
        ) : (
          <Camera className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />

      <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-gold flex items-center justify-center shadow-md border-2 border-white">
        <Camera className="h-3.5 w-3.5 text-navy" />
      </div>
    </div>
  )
}
