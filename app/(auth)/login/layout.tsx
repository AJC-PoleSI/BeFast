import type { Metadata } from "next"
import { DEFAULT_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/seo"

const TITLE = "BeFast Audencia — Connexion à la plateforme d'Audencia Junior Conseil"
const DESCRIPTION =
  "Connectez-vous à BeFast, la plateforme d'Audencia Junior Conseil (AJC) : suivez vos études, missions et documents, ou accédez à votre espace intervenant."

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/login" },
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    locale: "fr_FR",
    siteName: SITE_NAME,
    url: "/login",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/logo-ajc.png", alt: "Audencia Junior Conseil" }],
  },
}

// Données structurées : aident Google à afficher « BeFast » comme nom du site
// et à rattacher « Be Fast » / « BeFast Audencia » à la même entité.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/login`,
      name: SITE_NAME,
      alternateName: ["Be Fast", "BeFast Audencia", "Be Fast Audencia"],
      description: DEFAULT_DESCRIPTION,
      inLanguage: "fr-FR",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: "Audencia Junior Conseil",
      alternateName: ["AJC", "Audencia Junior Conseil BeFast"],
      url: SITE_URL,
      logo: `${SITE_URL}/logo-ajc.png`,
    },
  ],
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {children}
    </>
  )
}
