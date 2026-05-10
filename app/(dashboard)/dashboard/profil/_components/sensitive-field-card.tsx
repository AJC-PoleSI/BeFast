"use client"

import { useState } from "react"
import { SensitiveEditModal } from "./sensitive-edit-modal"
import type { PersonneWithRole } from "@/types/database.types"

interface SensitiveFieldCardProps {
  profile: PersonneWithRole
  isOwnProfile: boolean
}

export function SensitiveFieldCard({ profile, isOwnProfile }: SensitiveFieldCardProps) {
  const [modalField, setModalField] = useState<"nss" | "iban" | null>(null)

  const hasNss = !!profile.nss_encrypted
  const hasIban = !!profile.iban_encrypted

  return (
    <>
      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-100">
          <span className="material-symbols-outlined text-[#00236f] text-xl">lock</span>
          <div>
            <h2 className="font-manrope font-bold text-[#00236f] text-base">Données sensibles</h2>
            <p className="text-xs text-zinc-400">Chiffrées AES-256 — jamais stockées en clair</p>
          </div>
        </div>

        <div className="p-6 space-y-3">
          {/* NSS Row */}
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 hover:bg-zinc-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-zinc-500 text-lg">key</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-800">N° Sécurité Sociale</p>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  {hasNss ? (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">lock</span>
                      ••••••••••••••
                    </span>
                  ) : (
                    <span className="italic text-zinc-300">Non renseigné</span>
                  )}
                </p>
              </div>
            </div>
            {isOwnProfile && (
              <button
                onClick={() => setModalField("nss")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#00236f] hover:bg-[#d0d8ff] transition-colors"
              >
                <span className="material-symbols-outlined text-base">edit</span>
                Modifier
              </button>
            )}
          </div>

          {/* IBAN Row */}
          <div className="flex items-center justify-between rounded-xl border border-zinc-200 p-4 hover:bg-zinc-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-zinc-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-zinc-500 text-lg">account_balance</span>
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-800">IBAN</p>
                <p className="text-xs text-zinc-400 font-mono mt-0.5">
                  {hasIban ? (
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">lock</span>
                      ••••••••••••••••••••••
                    </span>
                  ) : (
                    <span className="italic text-zinc-300">Non renseigné</span>
                  )}
                </p>
              </div>
            </div>
            {isOwnProfile && (
              <button
                onClick={() => setModalField("iban")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#00236f] hover:bg-[#d0d8ff] transition-colors"
              >
                <span className="material-symbols-outlined text-base">edit</span>
                Modifier
              </button>
            )}
          </div>
        </div>
      </div>

      {modalField && (
        <SensitiveEditModal
          open={!!modalField}
          onOpenChange={(open) => { if (!open) setModalField(null) }}
          field={modalField}
          onSuccess={() => setModalField(null)}
        />
      )}
    </>
  )
}
