import { checkPageAccess } from "@/lib/auth/page-guards"
import { AccessDenied } from "@/components/layout/AccessDenied"

export default async function AdminClientsLayout({ children }: { children: React.ReactNode }) {
  const access = await checkPageAccess(["administration","prospection"])
  if (!access.ok) return <AccessDenied />
  return <>{children}</>
}
