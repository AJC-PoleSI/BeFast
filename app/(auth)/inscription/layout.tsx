import type { Metadata } from "next"
import { SITE_NAME } from "@/lib/seo"

const TITLE = "Créer un compte BeFast — Audencia Junior Conseil"
const DESCRIPTION =
  "Rejoignez BeFast Audencia : créez votre compte membre ou intervenant sur la plateforme d'Audencia Junior Conseil et accédez aux missions."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/inscription" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: SITE_NAME,
    url: "/inscription",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/logo-ajc.png", alt: "Audencia Junior Conseil" }],
  },
}

export default function InscriptionLayout({ children }: { children: React.ReactNode }) {
  return children
}
