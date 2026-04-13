"use client"

import { AvatarUpload } from "./avatar-upload"
import type { PersonneWithRole } from "@/types/database.types"

interface ProfileHeaderProps {
  profile: PersonneWithRole
  onAvatarUpdate: (url: string) => void
}

export function ProfileHeader({ profile, onAvatarUpdate }: ProfileHeaderProps) {
  const fullName = [profile.prenom, profile.nom].filter(Boolean).join(" ") || profile.email

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm px-6 py-5 flex flex-row items-center gap-4">
      <AvatarUpload
        avatarUrl={profile.avatar_url}
        prenom={profile.prenom}
        nom={profile.nom}
        onUpdate={onAvatarUpdate}
      />
      <div className="flex-1 min-w-0">
        <h2 className="text-lg font-manrope font-bold text-[#00236f] truncate">{fullName}</h2>
        <p className="text-sm text-slate-500 mt-0.5 truncate">{profile.email}</p>
        {profile.profils_types?.nom && (
          <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#d0d8ff] text-[#00236f]">
            {profile.profils_types.nom}
          </span>
        )}
      </div>
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        <div className="text-right">
          <p className="text-xs text-slate-400">Membre depuis</p>
          <p className="text-sm font-semibold text-slate-700">
            {profile.created_at
              ? new Date(profile.created_at).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
              : "—"}
          </p>
        </div>
      </div>
    </div>
  )
}
