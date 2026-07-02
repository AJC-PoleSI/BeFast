"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Rocket } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function ResetPasswordPage() {
  const router = useRouter()
  // "loading" tant qu'on n'a pas déterminé si une session de récupération existe.
  const [state, setState] = useState<"loading" | "ready" | "invalid">("loading")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    // PASSWORD_RECOVERY / SIGNED_IN : la session est établie (hash implicite ou
    // échange PKCE déjà fait via /auth/callback).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && active) setState("ready")
    })

    ;(async () => {
      // Flux PKCE arrivé directement ici (?code=) : on échange explicitement.
      const url = new URL(window.location.href)
      const code = url.searchParams.get("code")
      if (code) {
        try {
          await supabase.auth.exchangeCodeForSession(code)
        } catch {
          /* géré via getSession ci-dessous */
        }
      }
      const { data } = await supabase.auth.getSession()
      if (!active) return
      setState(data.session ? "ready" : "invalid")
    })()

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(formData: FormData) {
    const password = (formData.get("password") as string) ?? ""
    const confirm = (formData.get("confirmPassword") as string) ?? ""
    if (password !== confirm) {
      toast.error("Les mots de passe ne correspondent pas.", { position: "top-right" })
      return
    }
    if (password.length < 8) {
      toast.error("Le mot de passe doit contenir au moins 8 caractères.", { position: "top-right" })
      return
    }

    setSubmitting(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })
    setSubmitting(false)

    if (error) {
      toast.error("Impossible de définir le mot de passe. Le lien a peut-être expiré.", {
        position: "top-right",
      })
      return
    }

    toast.success("Mot de passe défini. Vous pouvez vous connecter.", { position: "top-right" })
    await supabase.auth.signOut()
    router.push("/login?reset=1")
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-[#ece7dc] bg-card/95 dark:border-border p-8 shadow-[0_8px_30px_rgba(0,35,111,0.08)] backdrop-blur">
      <div className="mb-8 flex flex-col items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Rocket className="h-4 w-4" />
          </div>
          <span className="font-manrope text-xl font-extrabold text-primary">BeFast</span>
        </div>
        <p className="text-sm text-muted-foreground">Audencia Junior Conseil</p>
      </div>

      <h2 className="mb-6 text-center text-lg font-semibold text-foreground">
        Définir mon mot de passe
      </h2>

      {state === "loading" && (
        <p className="text-center text-sm text-muted-foreground">Vérification du lien…</p>
      )}

      {state === "invalid" && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Ce lien est invalide ou a expiré. Demandez-en un nouveau.
          </p>
          <Link
            href="/mot-de-passe-oublie"
            className="inline-block text-sm font-medium text-primary hover:underline"
          >
            Renvoyer un lien
          </Link>
        </div>
      )}

      {state === "ready" && (
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              autoComplete="new-password"
            />
          </div>
          <Button type="submit" disabled={submitting} className="mt-2 w-full">
            {submitting ? "Enregistrement…" : "Définir mon mot de passe"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="hover:text-primary hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </div>
  )
}
