"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Shield, Lock, KeyRound } from "lucide-react"
import { SensitiveFieldModal } from "./SensitiveFieldModal"

interface SensitiveFieldsCardProps {
  hasNss: boolean
  hasIban: boolean
}

export function SensitiveFieldsCard({
  hasNss,
  hasIban,
}: SensitiveFieldsCardProps) {
  const [modalField, setModalField] = useState<"nss" | "iban" | null>(null)

  return (
    <>
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-border bg-gradient-to-r from-navy/[0.02] to-transparent">
          <Shield className="h-5 w-5 text-gold" />
          <h3 className="font-heading text-lg font-semibold">
            Données sensibles
          </h3>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-muted-foreground">
            Ces données sont chiffrées en AES-256 et ne sont jamais stockées en
            clair dans la base de données.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* NSS */}
            <div className="rounded-lg border border-border p-4 transition-all hover:shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    N° Sécurité Sociale
                  </span>
                </div>
                {hasNss ? (
                  <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
                    Chiffré
                  </span>
                ) : (
                  <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
                    Non renseigné
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-3">
                <div className="flex-1 text-sm text-muted-foreground font-mono tracking-wider">
                  {hasNss ? (
                    <span className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      •••• •••• •••• ••
                    </span>
                  ) : (
                    "—"
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModalField("nss")}
                  className="text-xs text-gold hover:text-gold/80 hover:bg-gold/10"
                >
                  {hasNss ? "Modifier" : "Ajouter"}
                </Button>
              </div>
            </div>

            {/* IBAN */}
            <div className="rounded-lg border border-border p-4 transition-all hover:shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">IBAN</span>
                </div>
                {hasIban ? (
                  <span className="text-xs text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full font-medium">
                    Chiffré
                  </span>
                ) : (
                  <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full font-medium">
                    Non renseigné
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-3">
                <div className="flex-1 text-sm text-muted-foreground font-mono tracking-wider">
                  {hasIban ? (
                    <span className="flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      FR•• •••• •••• ••••
                    </span>
                  ) : (
                    "—"
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModalField("iban")}
                  className="text-xs text-gold hover:text-gold/80 hover:bg-gold/10"
                >
                  {hasIban ? "Modifier" : "Ajouter"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {modalField && (
        <SensitiveFieldModal
          open={!!modalField}
          onOpenChange={(open) => {
            if (!open) setModalField(null)
          }}
          field={modalField}
          hasValue={modalField === "nss" ? hasNss : hasIban}
        />
      )}
    </>
  )
}
