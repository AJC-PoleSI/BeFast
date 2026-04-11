"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog"
import { Shield, Loader2, Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"

interface SensitiveFieldModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  field: "nss" | "iban"
  hasValue: boolean
}

const FIELD_LABELS = {
  nss: {
    title: "Numéro de sécurité sociale",
    description:
      "Ce champ est chiffré en AES-256 et n'est jamais stocké en clair.",
    placeholder: "1 85 12 75 108 004 20",
    help: "Format : 15 chiffres (ex: 1 85 12 75 108 004 20)",
  },
  iban: {
    title: "IBAN",
    description:
      "Vos coordonnées bancaires sont chiffrées et protégées.",
    placeholder: "FR76 3000 6000 0112 3456 7890 189",
    help: "Format français : FR suivi de 25 chiffres",
  },
}

export function SensitiveFieldModal({
  open,
  onOpenChange,
  field,
  hasValue,
}: SensitiveFieldModalProps) {
  const [value, setValue] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [showValue, setShowValue] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const labels = FIELD_LABELS[field]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (value !== confirmation) {
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
        toast.error(data.error || "Erreur lors de la mise à jour")
        return
      }

      toast.success("Donnée mise à jour et chiffrée avec succès")
      setValue("")
      setConfirmation("")
      onOpenChange(false)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogClose onClose={() => onOpenChange(false)} />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-gold" />
            {labels.title}
          </DialogTitle>
          <DialogDescription>{labels.description}</DialogDescription>
        </DialogHeader>

        {hasValue && (
          <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
            <Shield className="h-4 w-4" />
            <span>Valeur actuelle enregistrée et chiffrée</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="sensitive-value">
              {hasValue ? "Nouvelle valeur" : "Valeur"}
            </Label>
            <div className="relative">
              <Input
                id="sensitive-value"
                type={showValue ? "text" : "password"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={labels.placeholder}
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowValue(!showValue)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showValue ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">{labels.help}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sensitive-confirmation">Confirmation</Label>
            <Input
              id="sensitive-confirmation"
              type={showValue ? "text" : "password"}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="Confirmez la valeur"
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={submitting || !value || !confirmation}
              className="bg-gold text-navy font-semibold hover:bg-gold/90"
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
