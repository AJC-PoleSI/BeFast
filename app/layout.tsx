import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/sonner"
import { SpeedInsights } from "@vercel/speed-insights/next"

export const metadata: Metadata = {
  title: "BeFast — Odensia Junior Conseil",
  description: "Plateforme de gestion interne",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        {/* Preconnect pour éliminer le DNS lookup sur les fonts */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Material Symbols — axes réduits au minimum utilisé */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Manrope:wght@700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-[#f7f9fb] text-foreground antialiased">
        {children}
        <Toaster position="top-right" />
        <SpeedInsights />
      </body>
    </html>
  )
}
