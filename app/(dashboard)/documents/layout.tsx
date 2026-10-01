import { checkPageAccess } from "@/lib/auth/page-guards"
import { AccessDenied } from "@/components/layout/AccessDenied"

export default async function DocumentsLayout({ children }: { children: React.ReactNode }) {
  const access = await checkPageAccess(["documents"])
  if (!access.ok) return <AccessDenied />
  return <>{children}</>
}
