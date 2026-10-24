// Constantes SEO partagées (métadonnées, sitemap, robots, données structurées).

export const SITE_URL = "https://befast.audenciajuniorconseil.com"
export const SITE_NAME = "BeFast"

// Code de vérification « balise HTML » de la Search Console (URL-prefix property).
// Vide tant que la propriété n'est pas créée ; si la validation se fait par DNS,
// il n'est pas nécessaire.
export const GOOGLE_SITE_VERIFICATION = "HqgHM8fVPn4YFeiDyEY82KHVX-8WaaxbU03-W8yPkFs"

// Pages publiques indexables (les seules que robots.txt autorise).
export const PUBLIC_PATHS = [
  "/login",
  "/inscription",
  "/cgu",
  "/politique-confidentialite",
] as const

export const DEFAULT_DESCRIPTION =
  "BeFast Audencia : la plateforme d'Audencia Junior Conseil (AJC), la Junior-Entreprise d'Audencia. Études, missions, intervenants et documents au même endroit."
