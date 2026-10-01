import { checkPageAccess } from "@/lib/auth/page-guards"
import { AccessDenied } from "@/components/layout/AccessDenied"

export default async function ProspectionLayout({ children }: { children: React.ReactNode }) {
  const access = await checkPageAccess(["prospection"])
  if (!access.ok) return <AccessDenied />
  return <>{children}</>
}
