import { checkPageAccess } from "@/lib/auth/page-guards"
import { AccessDenied } from "@/components/layout/AccessDenied"

export default async function AdminDonneesLayout({ children }: { children: React.ReactNode }) {
  const access = await checkPageAccess(["administration"])
  if (!access.ok) return <AccessDenied message="L'explorateur et les exports de données sont réservés aux administrateurs." />
  return <>{children}</>
}
