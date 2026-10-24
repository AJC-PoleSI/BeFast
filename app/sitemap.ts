import type { MetadataRoute } from "next"
import { PUBLIC_PATHS, SITE_URL } from "@/lib/seo"

// Seules les pages publiques sont listées : le reste de la plateforme est
// derrière une authentification et n'a pas vocation à être indexé.
export default function sitemap(): MetadataRoute.Sitemap {
  const priorities: Record<string, number> = {
    "/login": 1,
    "/inscription": 0.8,
    "/cgu": 0.3,
    "/politique-confidentialite": 0.3,
  }
  return PUBLIC_PATHS.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "monthly" as const,
    priority: priorities[path] ?? 0.3,
  }))
}
