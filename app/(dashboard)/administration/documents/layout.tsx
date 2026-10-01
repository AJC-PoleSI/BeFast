import { checkPageAccess } from "@/lib/auth/page-guards"
import { AccessDenied } from "@/components/layout/AccessDenied"

export default async function AdminDocumentsLayout({ children }: { children: React.ReactNode }) {
  const access = await checkPageAccess(["administration","gerer_parametres"])
  if (!access.ok) return <AccessDenied message="Les modèles de documents sont réservés à l'administration." />
  return <>{children}</>
}
