import { getPageProfile } from "@/lib/auth/page-guards"
import { AccessDenied } from "@/components/layout/AccessDenied"

/**
 * Explorateur de tables et exports CSV : les routes API (/api/admin/explore,
 * /api/admin/export) exigent le rôle de base « administrateur ». Le layout
 * applique la même règle, sinon un porteur d'`administration` voyait les
 * onglets puis des erreurs 403 à chaque chargement.
 */
export default async function AdminDonneesLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getPageProfile()
  if (ctx?.profile?.profils_types?.slug !== "administrateur") {
    return <AccessDenied message="L'explorateur et les exports de données sont réservés aux administrateurs." />
  }
  return <>{children}</>
}
