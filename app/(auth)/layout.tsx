import type { Metadata } from "next"
import { GlowBackground } from "@/components/ui/background-glow"

// Par défaut, les pages d'auth ne sont pas indexées (mot de passe oublié,
// réinitialisation, vérification d'e-mail). login et inscription réactivent
// l'indexation dans leur propre layout.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <GlowBackground position="center">
      <div className="flex min-h-screen items-center justify-center p-4">
        {children}
      </div>
    </GlowBackground>
  )
}
