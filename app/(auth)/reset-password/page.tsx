"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Rocket } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { confirmPasswordSetup } from "@/lib/actions/password-campaign"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

// Annoncer « le lien a expiré » quel que soit l'échec envoyait les membres
// redemander un lien alors que le lien était valide et que c'est le mot de
// passe qui était refusé. On restitue la vraie raison.
function messageErreur(error: { code?: string; status?: number; message: string }): string {
  switch (error.code) {
    case "same_password":
      return "Ce mot de passe est identique à votre mot de passe actuel. Choisissez-en un autre."
    case "weak_password":
      return "Mot de passe trop faible. Choisissez-en un plus long ou moins courant."
    case "over_request_rate_limit":
      return "Trop de tentatives. Patientez quelques minutes avant de réessayer."
  }
  if (error.status === 401 || error.status === 403) {
    return "Ce lien n'est plus valide. Demandez-en un nouveau depuis « Mot de passe oublié »."
  }
  if (!error.status) {
    return "Connexion interrompue. Vérifiez votre réseau et réessayez."
  }
  return `Impossible de définir le mot de passe : ${error.message}`
}

export default function ResetPasswordPage() {
  const router = useRouter()
  // "loading" tant qu'on n'a pas déterminé si une session de récupération existe.
  const [state, setState] = useState<"loading" | "ready" | "invalid">("loading")
  const [expired, setExpired] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // Le token de récupération (token_hash/code) est à usage unique : si cet
  // effet s'exécute deux fois pour le même chargement (double-invocation
  // React Strict Mode en dev, remount, retour en arrière...), le deuxième
  // verifyOtp/exchangeCodeForSession casse la session que le premier venait
  // d'établir. Ce ref (contrairement à une variable locale à l'effet)
  // survit à un cleanup+remount et garantit qu'on ne consomme le token
  // qu'une seule fois.
  const tokenConsumedRef = useRef(false)

  useEffect(() => {
    const supabase = createClient()
    let active = true

    // Lien 72h rejeté côté serveur (route /api/password-reset/verify) : pas de
    // token à échanger, on affiche directement l'état invalide/expiré.
    const errCode = new URL(window.location.href).searchParams.get("e")
    if (errCode) {
      setExpired(errCode === "expired")
      setState("invalid")
      return
    }

    // PASSWORD_RECOVERY / SIGNED_IN : la session est établie (hash implicite ou
    // échange PKCE déjà fait via /auth/callback).
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && active) setState("ready")
    })

    if (tokenConsumedRef.current) {
      // Deuxième passage de l'effet : le token a déjà été échangé par le
      // premier, on relit juste la session qu'il a établie.
      supabase.auth.getSession().then(({ data }) => {
        if (active) setState(data.session ? "ready" : "invalid")
      })
      return () => {
        active = false
        sub.subscription.unsubscribe()
      }
    }
    tokenConsumedRef.current = true

    ;(async () => {
      // Flux PKCE arrivé directement ici (?code=) : on échange explicitement.
      const url = new URL(window.location.href)
      const code = url.searchParams.get("code")
      const tokenHash = url.searchParams.get("token_hash")

      if (tokenHash) {
        try {
          await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "recovery" })
        } catch {
          /* géré via getSession ci-dessous */
        }
      } else if (code) {
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
      // Trace l'erreur brute : elle n'est visible nulle part côté serveur
      // (updateUser tape directement l'API Supabase), donc sans ce log il est
      // impossible de savoir pourquoi un membre bloque.
      console.error("[reset-password] updateUser", {
        code: (error as { code?: string }).code,
        status: error.status,
        message: error.message,
      })
      toast.error(messageErreur(error), { position: "top-right" })
      return
    }

    // Marque le suivi de campagne (best-effort, ne bloque pas la connexion).
    try {
      await confirmPasswordSetup()
    } catch {
      /* ignore */
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
        Réinitialiser mon mot de passe
      </h2>

      {state === "loading" && (
        <p className="text-center text-sm text-muted-foreground">Vérification du lien…</p>
      )}

      {state === "invalid" && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            {expired
              ? "Ce lien a expiré (valable 72 heures). Demandez-en un nouveau."
              : "Ce lien est invalide ou a expiré. Demandez-en un nouveau."}
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
            {submitting ? "Enregistrement…" : "Réinitialiser mon mot de passe"}
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
