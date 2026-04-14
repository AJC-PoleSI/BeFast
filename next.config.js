/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true, // Disable image optimization (uses __dirname which isn't available in Edge Runtime)
  },
}
module.exports = nextConfig
