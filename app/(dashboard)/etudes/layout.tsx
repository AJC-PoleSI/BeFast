import { checkPageAccess } from "@/lib/auth/page-guards"
import { AccessDenied } from "@/components/layout/AccessDenied"

export default async function EtudesLayout({ children }: { children: React.ReactNode }) {
  const access = await checkPageAccess(["etudes"])
  if (!access.ok) return <AccessDenied />
  return <>{children}</>
}
