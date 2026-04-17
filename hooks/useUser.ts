"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import type { PersonneWithRole, Permissions } from "@/types/database.types"
import type { User } from "@supabase/supabase-js"

interface UseUserReturn {
  user: User | null
  profile: PersonneWithRole | null
  permissions: Permissions | null
  loading: boolean
  isAdmin: boolean
}

const emptyPermissions: Permissions = {
  dashboard: false,
  profil: false,
  missions: false,
  etudes: false,
  prospection: false,
  statistiques: false,
  administration: false,
  membres: false,
  documents: false,
  nouvelle_mission: false,
  voir_documents_membres: false,
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<PersonneWithRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        setLoading(false)
        return
      }
      setUser(user)

      const { data } = await supabase
        .from("personnes")
        .select("*, profils_types(*)")
        .eq("id", user.id)
        .single()

      if (data) setProfile(data as PersonneWithRole)
      setLoading(false)
    }

    load()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      load()
    })

    return () => subscription.unsubscribe()
  }, [])

  const permissions = profile?.profils_types?.permissions ?? null
  const isAdmin = profile?.profils_types?.slug === "administrateur"

  return { user, profile, permissions, loading, isAdmin }
}
