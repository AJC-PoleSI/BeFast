"use client"

import { useEffect, useTransition } from "react"
import Link from "next/link"
import { Rocket } from "lucide-react"
import { signIn } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function LoginPage() {
  const [isPending, startTransition] = useTransition()

  // Success banner after clicking the email-verification link.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("verified") === "1") {
      toast.success("Adresse email vérifiée. Vous pouvez vous connecter.", {
        duration: 6000,
        position: "top-right",
      })
      window.history.replaceState(null, "", window.location.pathname)
    }
  }, [])

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await signIn(formData)
      if (result?.error) {
        toast.error(result.error, { duration: 5000, position: "top-right" })
      }
    })
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-[#ece7dc] bg-card/95 dark:border-border p-8 shadow-[0_8px_30px_rgba(0,35,111,0.08)] backdrop-blur">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Rocket className="h-4 w-4" />
          </div>
          <span className="font-manrope text-xl font-extrabold text-primary">
            BeFast
          </span>
        </div>
        <p className="text-sm text-muted-foreground">Audencia Junior Conseil</p>
      </div>

      <h2 className="mb-6 text-center text-lg font-semibold text-foreground">
        Connexion
      </h2>

      <form action={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="prenom.nom@audencia.com"
            required
            autoComplete="email"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
        </div>

        <Button type="submit" disabled={isPending} className="mt-2 w-full">
          {isPending ? "Connexion…" : "Se connecter"}
        </Button>
      </form>

      <div className="mt-6 flex flex-col items-center gap-2 text-sm">
        <Link
          href="/mot-de-passe-oublie"
          className="text-muted-foreground hover:text-primary hover:underline"
        >
          Mot de passe oublié ?
        </Link>
        <p className="text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link
            href="/inscription"
            className="font-medium text-primary hover:underline"
          >
            S&apos;inscrire
          </Link>
        </p>
      </div>
    </div>
  )
}
