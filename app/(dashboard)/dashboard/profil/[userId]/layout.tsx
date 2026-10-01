import { checkPageAccess, getPageProfile } from "@/lib/auth/page-guards"
import { AccessDenied } from "@/components/layout/AccessDenied"

/**
 * Fiche d'un AUTRE membre : réservée à la gestion des membres (`membres`), à
 * la consultation de leurs justificatifs (`voir_documents_membres`, Pôle RH)
 * et aux porteurs d'une permission PII (`voir_nss`, `voir_rib`) — mêmes clés
 * que la page et que GET /api/profil?targetUserId.
 * Exception : consulter sa propre fiche par son id reste autorisé.
 */
export default async function FicheMembreLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { userId: string }
}) {
  const ctx = await getPageProfile()
  if (ctx?.userId === params.userId) return <>{children}</>

  const access = await checkPageAccess(["membres", "voir_documents_membres", "voir_nss", "voir_rib"])
  if (!access.ok)
    return <AccessDenied message="La fiche d'un membre est réservée à la gestion des membres (administration, Pôle RH)." />
  return <>{children}</>
}
