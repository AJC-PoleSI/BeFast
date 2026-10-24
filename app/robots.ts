import type { MetadataRoute } from "next"
import { PUBLIC_PATHS, SITE_URL } from "@/lib/seo"

// Liste blanche : tout est fermé sauf les pages publiques (la règle la plus
// spécifique l'emporte). Évite aussi de dévoiler l'arborescence privée.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: [...PUBLIC_PATHS], disallow: "/" }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
