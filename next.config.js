/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion", "react-aria-components"],
    serverActions: {
      // Upload de PDF (signature électronique) via server action
      bodySizeLimit: "8mb",
    },
  },
  async headers() {
    // En-têtes de sécurité appliqués à toutes les réponses. On évite volontairement
    // une CSP stricte de scripts (risque de casser les scripts inline de Next sans
    // gestion de nonce) ; `frame-ancestors 'none'` verrouille l'iframing sans
    // impacter le chargement des ressources.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        ],
      },
    ]
  },
}
module.exports = nextConfig
