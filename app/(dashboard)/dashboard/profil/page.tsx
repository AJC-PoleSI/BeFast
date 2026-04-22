"use client"

import { useState, useEffect } from "react"
import { useUser } from "@/hooks/useUser"
import { Skeleton } from "@/components/ui/skeleton"
import { ProfileHeader } from "./_components/profile-header"
import { ProfileInfoCard } from "./_components/profile-info-card"
import { SensitiveFieldCard } from "./_components/sensitive-field-card"
import { DynamicFieldsCard } from "./_components/dynamic-fields-card"
import { DocumentsGrid } from "./_components/DocumentsGrid"
import type { PersonneWithRole } from "@/types/database.types"

export default function ProfilPage() {
  const { profile: initialProfile, loading, isAdmin } = useUser()
  const [profile, setProfile] = useState<PersonneWithRole | null>(null)

  useEffect(() => {
    if (initialProfile) setProfile(initialProfile)
  }, [initialProfile])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <Skeleton className="lg:col-span-8 h-96 rounded-xl" />
          <Skeleton className="lg:col-span-4 h-96 rounded-xl" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-slate-400">Profil introuvable.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-1">
            Mon espace / Profil
          </p>
          <h1 className="text-2xl font-manrope font-black text-[#00236f]">Tableau de Bord Personnel</h1>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <span className="material-symbols-outlined text-lg">download</span>
            Exporter Données
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#00236f] text-white text-sm font-semibold hover:bg-[#1e3a8a] transition-colors">
            <span className="material-symbols-outlined text-lg">edit</span>
            Modifier le Profil
          </button>
        </div>
      </div>

      {/* Profile header card */}
      <ProfileHeader
        profile={profile}
        onAvatarUpdate={(url) =>
          setProfile((prev) => prev ? { ...prev, avatar_url: url } : prev)
        }
      />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left column — col-span-8 */}
        <div className="lg:col-span-8 space-y-6">
          <ProfileInfoCard
            profile={profile}
            onUpdate={(updated) => setProfile(updated)}
            isAdmin={isAdmin}
          />
          <SensitiveFieldCard
            profile={profile}
            isOwnProfile={true}
          />
          <DynamicFieldsCard isOwnProfile={true} />
        </div>

        {/* Right column — col-span-4 */}
        <div className="lg:col-span-4 space-y-4">
          {/* Documents card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <DocumentsGrid /></div>

          {/* Security banner */}
          <div className="bg-[#00236f] rounded-xl p-4 text-white">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[#d0d8ff] text-2xl shrink-0">shield</span>
              <div>
                <p className="font-manrope font-bold text-sm mb-1">Documents sécurisés</p>
                <p className="text-xs text-blue-200 leading-relaxed">
                  Chiffrement AES-256. Conformité RGPD. Accès réservé aux administrateurs habilités.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
