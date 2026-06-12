import { GlowBackground } from "@/components/ui/background-glow"

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
