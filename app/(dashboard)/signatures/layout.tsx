import { checkPageAccess } from "@/lib/auth/page-guards"
import { AccessDenied } from "@/components/layout/AccessDenied"

/**
 * File de signature interne (envoi de conventions/RDM, suivi, file du bureau).
 * Les membres et intervenants qui doivent signer leur propre bulletin passent
 * par le lien LiveConsent reçu par email (et la bannière du tableau de bord) :
 * cette page n'est pas nécessaire pour signer.
 */
export default async function SignaturesLayout({ children }: { children: React.ReactNode }) {
  const access = await checkPageAccess(["etudes", "signer_documents", "signer_ba"])
  if (!access.ok)
    return (
      <AccessDenied message="L'espace de signature est réservé aux membres qui envoient des documents en signature et aux signataires du bureau." />
    )
  return <>{children}</>
}
