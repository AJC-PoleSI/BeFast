import { checkPageAccess } from "@/lib/auth/page-guards"
import { AccessDenied } from "@/components/layout/AccessDenied"

export default async function ProfilLayout({ children }: { children: React.ReactNode }) {
  const access = await checkPageAccess(["profil"])
  if (!access.ok) return <AccessDenied />
  return <>{children}</>
}
