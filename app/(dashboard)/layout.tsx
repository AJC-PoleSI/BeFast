import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import type { PersonneWithRole, Permissions } from "@/types/database.types"
import { DashboardShell } from "./dashboard-shell"
import { UserProvider } from "@/hooks/useUser"

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

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const { data: personne } = await supabase
    .from("personnes")
    .select("*, profils_types(*)")
    .eq("id", user.id)
    .single()

  const profile = personne as PersonneWithRole | null
  const rolePerms = profile?.profils_types?.permissions ?? null
  const isAdmin = profile?.profils_types?.slug === "administrateur"

  let polePerms: Partial<Permissions> = {}
  const pole = (personne as any)?.pole as string | null
  if (pole) {
    const { data: param } = await supabase
      .from("parametres")
      .select("value")
      .eq("key", "pole_permissions")
      .maybeSingle()
    if (param?.value) {
      try {
        const map = JSON.parse(param.value) as Record<string, Partial<Permissions>>
        polePerms = map[pole] ?? {}
      } catch {}
    }
  }

  const permissions = rolePerms
    ? ({ ...emptyPermissions, ...rolePerms, ...polePerms } as Permissions)
    : null

  const userName = profile
    ? [profile.prenom, profile.nom].filter(Boolean).join(" ") || profile.email
    : user.email ?? null

  const initialUserData = {
    user,
    profile,
    permissions,
    isAdmin,
    loading: false,
  }

  // Always render shell with header; permissions control sidebar/nav
  return (
    <UserProvider initialData={initialUserData}>
      <DashboardShell permissions={permissions} isAdmin={isAdmin} userName={userName}>
        {children}
      </DashboardShell>
    </UserProvider>
  )
}
