"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, Loader2, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

interface SensitiveEditModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  field: "nss" | "iban"
  onSuccess: () => void
}

const FIELD_CONFIG = {
  nss: {
    title: "Modifier le numero de securite sociale",
    label: "Nouveau NSS",
    confirmLabel: "Confirmer le NSS",
    placeholder: "1 85 12 75 108 004 20",
    description: "Chiffre en AES-256 — jamais stocke en clair.",
  },
  iban: {
    title: "Modifier l'IBAN",
    label: "Nouvel IBAN",
    confirmLabel: "Confirmer l'IBAN",
    placeholder: "FR76 3000 6000 0112 3456 7890 189",
    description: "Vos coordonnees bancaires sont chiffrees et protegees.",
  },
}

export function SensitiveEditModal({
  open,
  onOpenChange,
  field,
  onSuccess,
}: SensitiveEditModalProps) {
  const [value, setValue] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [showValue, setShowValue] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [confirmError, setConfirmError] = useState("")

  const config = FIELD_CONFIG[field]

  const handleClose = () => {
    setValue("")
    setConfirmation("")
    setConfirmError("")
    onOpenChange(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setConfirmError("")

    if (value !== confirmation) {
      setConfirmError("Les valeurs ne correspondent pas.")
      toast.error("Les valeurs ne correspondent pas.")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/profil/sensitive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field, value, confirmation }),
      })

      const data = await res.json()
      if (!res.ok) {
        const msg = data.error || "Erreur lors de l'enregistrement"
        setConfirmError(msg)
        toast.error(msg)
        return
      }

      toast.success("Enregistre avec succes.")
      handleClose()
      onSuccess()
    } catch {
      toast.error("Erreur reseau")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogClose onClose={handleClose} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#C9A84C]" />
            {config.title}
          </DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="sensitive-value">{config.label}</Label>
            <div className="relative">
              <Input
                id="sensitive-value"
                type={showValue ? "text" : "password"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={config.placeholder}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowValue(!showValue)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sensitive-confirmation">{config.confirmLabel}</Label>
            <Input
              id="sensitive-confirmation"
              type={showValue ? "text" : "password"}
              value={confirmation}
              onChange={(e) => {
                setConfirmation(e.target.value)
                setConfirmError("")
              }}
              placeholder="Confirmez la valeur"
              required
            />
            {confirmError && (
              <p className="text-sm text-red-500">{confirmError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={submitting || !value || !confirmation}
              className="bg-[#C9A84C] text-[#0D1B2A] font-semibold hover:bg-[#C9A84C]/90"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Chiffrement...
                </>
              ) : (
                "Enregistrer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
