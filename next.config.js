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
}
module.exports = nextConfig
