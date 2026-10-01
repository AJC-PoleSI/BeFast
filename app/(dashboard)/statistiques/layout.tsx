import { checkPageAccess } from "@/lib/auth/page-guards"
import { AccessDenied } from "@/components/layout/AccessDenied"

export default async function StatistiquesLayout({ children }: { children: React.ReactNode }) {
  const access = await checkPageAccess(["statistiques"])
  if (!access.ok) return <AccessDenied />
  return <>{children}</>
}
