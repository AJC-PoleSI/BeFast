import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import type { PersonneWithRole, Permissions } from "@/types/database.types"
import { DashboardShell } from "./dashboard-shell"

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
  const permissions = profile?.profils_types?.permissions ?? null
  const userName = profile
    ? [profile.prenom, profile.nom].filter(Boolean).join(" ") || profile.email
    : user.email ?? null

  // If no role assigned, only allow /attente page
  const hasRole = !!profile?.profil_type_id
  if (!hasRole) {
    return (
      <>
        {children}
      </>
    )
  }

  return (
    <DashboardShell permissions={permissions} userName={userName}>
      {children}
    </DashboardShell>
  )
}
