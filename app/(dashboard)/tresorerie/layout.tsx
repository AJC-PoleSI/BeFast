import { checkPageAccess } from "@/lib/auth/page-guards"
import { AccessDenied } from "@/components/layout/AccessDenied"

export default async function TresorerieLayout({ children }: { children: React.ReactNode }) {
  const access = await checkPageAccess(["voir_factures"])
  if (!access.ok)
    return (
      <AccessDenied message="La trésorerie est réservée aux détenteurs de la permission « Trésorerie » (Présidente, Trésorier·ère, Pôle Trésorerie, administrateurs)." />
    )
  return <>{children}</>
}
