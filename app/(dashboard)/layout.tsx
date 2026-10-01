import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import type { Permissions } from "@/types/database.types"
import { DashboardShell } from "./dashboard-shell"
import { UserProvider } from "@/hooks/useUser"
import { getCachedProfile } from "@/lib/auth/cached-profile"
import { resolveEffectivePermissions } from "@/lib/auth/permissions"


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

  // Cached profile query — keyed by user.id. After first visit, this is a
  // ~5ms cache hit (vs ~200ms DB query) for the next 5 minutes.
  const profile = await getCachedProfile(user.id)

  // Un compte supprimé n'a plus rien à faire ici : ses données ont été purgées.
  // La restriction de permissions plus bas ne suffit pas — elle laisse l'accès
  // au profil et aux documents, ce qui convient à un compte en attente, pas à
  // un compte supprimé. Le bannissement Supabase ne coupe la session qu'au
  // prochain rafraîchissement du jeton ; cette garde ferme l'intervalle.
  if (profile?.account_status === "deleted") {
    redirect("/login?compte=supprime")
  }

  const isAdmin = profile?.profils_types?.slug === "administrateur"

  // Permissions effectives = rôle de base ∪ postes (bureau/pôles) assignés.
  // `resolveEffectivePermissions` applique aussi la restriction des comptes non
  // validés (profil + documents uniquement) — même source de vérité que les
  // gardes serveur, plus de liste de clés dupliquée ici.
  const permissions: Permissions | null = profile
    ? resolveEffectivePermissions(profile)
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
