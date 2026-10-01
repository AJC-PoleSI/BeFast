import { checkPageAccess } from "@/lib/auth/page-guards"
import { AccessDenied } from "@/components/layout/AccessDenied"

export default async function AdminMembresLayout({ children }: { children: React.ReactNode }) {
  const access = await checkPageAccess(["membres"])
  if (!access.ok) return <AccessDenied message="La gestion des membres et des droits est réservée à l'administration et au Pôle RH." />
  return <>{children}</>
}
