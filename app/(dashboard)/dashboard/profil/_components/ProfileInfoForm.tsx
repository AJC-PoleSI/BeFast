"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Save, Pencil, X } from "lucide-react"
import { toast } from "sonner"
import type { ProfileFormValues } from "@/app/(dashboard)/dashboard/profil/_lib/schemas"

interface ProfileInfoFormProps {
  initialValues: ProfileFormValues
  targetUserId?: string
  readOnly?: boolean
}

const FIELD_CONFIG = [
  { name: "prenom" as const, label: "Prénom", required: true },
  { name: "nom" as const, label: "Nom", required: true },
  { name: "portable" as const, label: "Téléphone", required: false },
  { name: "promo" as const, label: "Promo", required: false },
  { name: "adresse" as const, label: "Adresse", required: false },
  { name: "ville" as const, label: "Ville", required: false },
  { name: "code_postal" as const, label: "Code postal", required: false },
  { name: "pole" as const, label: "Pôle", required: false },
]

export function ProfileInfoForm({
  initialValues,
  targetUserId,
  readOnly = false,
}: ProfileInfoFormProps) {
  const [editing, setEditing] = useState(false)
  const [values, setValues] = useState<ProfileFormValues>(initialValues)
  const [saving, setSaving] = useState(false)

  const handleChange = (field: keyof ProfileFormValues, val: string) => {
    setValues((prev) => ({ ...prev, [field]: val }))
  }

  const handleCancel = () => {
    setValues(initialValues)
    setEditing(false)
  }

  const handleSave = async () => {
    if (!values.prenom?.trim() || !values.nom?.trim()) {
      toast.error("Le prénom et le nom sont requis")
      return
    }

    setSaving(true)
    try {
      const url = targetUserId
        ? `/api/profil?targetUserId=${targetUserId}`
        : "/api/profil"

      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || "Erreur lors de la mise à jour")
        return
      }

      toast.success("Profil mis à jour")
      setEditing(false)
    } catch {
      toast.error("Erreur réseau")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-navy/[0.02] to-transparent">
        <h3 className="font-heading text-lg font-semibold">
          Informations personnelles
        </h3>
        {!readOnly && !editing && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setEditing(true)}
            className="text-gold hover:text-gold/80 hover:bg-gold/10"
          >
            <Pencil className="h-4 w-4 mr-1.5" />
            Modifier
          </Button>
        )}
      </div>

      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {FIELD_CONFIG.map(({ name, label, required }) => (
            <div key={name} className="space-y-1.5">
              <Label
                htmlFor={`profile-${name}`}
                className="text-sm font-medium text-muted-foreground"
              >
                {label}
                {required && <span className="text-red-500 ml-0.5">*</span>}
              </Label>
              {editing ? (
                <Input
                  id={`profile-${name}`}
                  value={values[name] || ""}
                  onChange={(e) => handleChange(name, e.target.value)}
                  className="transition-all duration-200"
                />
              ) : (
                <p className="text-sm min-h-[36px] flex items-center px-3 py-2 rounded-md bg-muted/30">
                  {values[name] || (
                    <span className="text-muted-foreground/50 italic">
                      Non renseigné
                    </span>
                  )}
                </p>
              )}
            </div>
          ))}
        </div>

        {editing && (
          <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-border">
            <Button
              variant="ghost"
              onClick={handleCancel}
              disabled={saving}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1.5" />
              Annuler
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gold text-navy font-semibold hover:bg-gold/90"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1.5" />
                  Enregistrer
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
