"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { Rocket } from "lucide-react"
import { signIn } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

// Retours d'autres écrans vers /login. Avant le 02/10/2026, seul `verified`
// était lu — et par un toast lancé au montage, perdu car le <Toaster> du layout
// racine n'est pas encore abonné à ce moment-là : même « Adresse email
// vérifiée » ne s'affichait pas. D'où un bandeau dans la carte.
type Notice = { kind: "success" | "error"; text: string }
const URL_NOTICES: Record<string, Record<string, Notice>> = {
  verified: { "1": { kind: "success", text: "Adresse email vérifiée. Vous pouvez vous connecter." } },
  sso: {
    invalid: { kind: "error", text: "Le lien de connexion a expiré. Connectez-vous ici avec votre email et votre mot de passe." },
    unknown: { kind: "error", text: "Compte Be Fast introuvable ou email non vérifié. Connectez-vous ici, ou créez votre compte." },
    error: { kind: "error", text: "La connexion automatique a échoué. Connectez-vous ici avec votre email et votre mot de passe." },
  },
  error: { lien_invalide: { kind: "error", text: "Ce lien est invalide ou a expiré." } },
  compte: { supprime: { kind: "error", text: "Ce compte a été supprimé." } },
}

export default function LoginPage() {
  const [isPending, startTransition] = useTransition()
  const [needsVerification, setNeedsVerification] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    for (const [key, byValue] of Object.entries(URL_NOTICES)) {
      const found = byValue[params.get(key) ?? ""]
      if (!found) continue
      setNotice(found)
      window.history.replaceState(null, "", window.location.pathname)
      break
    }
  }, [])

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await signIn(formData)
      setNeedsVerification(!!result?.needsVerification)
      if (result?.error) {
        toast.error(result.error, { duration: 6000, position: "top-right" })
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

      {notice && (
        <div
          role="status"
          className={`mb-4 rounded-md border p-3 text-sm ${
            notice.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {notice.text}
        </div>
      )}

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

      {needsVerification && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Votre adresse email n&apos;est pas encore vérifiée.{" "}
          <Link href="/verifier-email" className="font-medium underline underline-offset-2">
            Renvoyer l&apos;email de vérification
          </Link>
        </div>
      )}

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
        <Link
          href="/politique-confidentialite"
          className="mt-2 text-xs text-muted-foreground hover:text-primary hover:underline"
        >
          Politique de confidentialité
        </Link>
      </div>
    </div>
  )
}
