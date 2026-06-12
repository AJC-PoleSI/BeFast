import Link from "next/link"
import { Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { GlowBackground } from "@/components/ui/background-glow"

export default function Home() {
  return (
    <GlowBackground position="center">
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm shadow-black/10">
              <Rocket className="h-7 w-7" />
            </div>
            <div>
              <h1 className="font-manrope text-4xl font-extrabold text-primary">
                BeFast
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Audencia Junior Conseil — Plateforme de gestion interne
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Button asChild size="lg" className="w-56">
              <Link href="/login">Se connecter</Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-56">
              <Link href="/inscription">Créer un compte</Link>
            </Button>
          </div>
        </div>
      </div>
    </GlowBackground>
  )
}
