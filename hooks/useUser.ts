"use client"

import { createClient } from "@/lib/supabase/client"
import { useEffect, useState } from "react"
import type { PersonneWithRole, Permissions, PermissionKey } from "@/types/database.types"
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
  assigner_intervenants: false,
  parametres_structure: false,
  selectionner_candidats: false,
  valider_comptes: false,
  valider_bv: false,
  voir_factures: false,
  gerer_parametres: false,
  publier_etudes: false,
  publier_missions: false,
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<PersonneWithRole | null>(null)
  const [polePerms, setPolePerms] = useState<Partial<Permissions>>({})
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

      if (data) {
        setProfile(data as PersonneWithRole)
        // Load pole-specific permissions
        const pole = (data as any).pole as string | null
        if (pole) {
          const { data: param } = await supabase
            .from("parametres")
            .select("value")
            .eq("key", "pole_permissions")
            .maybeSingle()
          if (param?.value) {
            try {
              const map = JSON.parse(param.value) as Record<string, Partial<Permissions>>
              setPolePerms(map[pole] ?? {})
            } catch {
              setPolePerms({})
            }
          }
        }
      }
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

  const rolePerms = profile?.profils_types?.permissions ?? null
  const permissions = rolePerms
    ? ({ ...emptyPermissions, ...rolePerms, ...polePerms } as Permissions)
    : null
  const isAdmin = profile?.profils_types?.slug === "administrateur"

  return { user, profile, permissions, loading, isAdmin }
}
