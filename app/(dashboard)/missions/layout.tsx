import { checkPageAccess } from "@/lib/auth/page-guards"
import { AccessDenied } from "@/components/layout/AccessDenied"

export default async function MissionsLayout({ children }: { children: React.ReactNode }) {
  const access = await checkPageAccess(["missions"])
  if (!access.ok) return <AccessDenied />
  return <>{children}</>
}
