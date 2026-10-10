"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Rocket } from "lucide-react"
import { resetPassword } from "@/lib/actions/auth"
import { createClient } from "@/lib/supabase/client"
import { normaliserCodeRecuperation } from "@/lib/auth/recovery-code"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

// Supabase renvoie `otp_expired` aussi bien pour un code faux que pour un code
// périmé ou déjà utilisé : on ne peut pas distinguer, le message couvre les trois.
function messageErreurCode(error: { code?: string; status?: number }): string {
  if (error.code === "over_request_rate_limit" || error.status === 429) {
    return "Trop de tentatives. Patientez quelques minutes avant de réessayer."
  }
  if (!error.status) {
    return "Connexion interrompue. Vérifiez votre réseau et réessayez."
  }
  return "Code incorrect ou expiré. Vérifiez-le, ou demandez un nouveau code (seul le dernier reçu est valable)."
}

export default function MotDePasseOubliePage() {
  const router = useRouter()
  const [etape, setEtape] = useState<"email" | "code">("email")
  const [email, setEmail] = useState("")
  const [isPending, startTransition] = useTransition()
  const [verifying, setVerifying] = useState(false)

  function envoyerCode(adresse: string, onSent?: () => void) {
    const formData = new FormData()
    formData.set("email", adresse)
    startTransition(async () => {
      const result = await resetPassword(formData)
      toast.success(result.success, { duration: 6000, position: "top-right" })
      onSent?.()
    })
  }

  function handleEmail(formData: FormData) {
    const adresse = ((formData.get("email") as string) ?? "").trim()
    if (!adresse) return
    setEmail(adresse)
    envoyerCode(adresse, () => setEtape("code"))
  }

  async function handleCode(formData: FormData) {
    const adresse = ((formData.get("email") as string) ?? "").trim().toLowerCase()
    const code = normaliserCodeRecuperation((formData.get("code") as string) ?? "")
    if (!adresse) {
      toast.error("Indiquez l'adresse email du compte.", { position: "top-right" })
      return
    }
    if (!code) {
      toast.error("Le code reçu par email est composé uniquement de chiffres.", {
        position: "top-right",
      })
      return
    }

    setVerifying(true)
    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({ email: adresse, token: code, type: "recovery" })
    if (error) {
      setVerifying(false)
      console.error("[mot-de-passe-oublie] verifyOtp", {
        code: (error as { code?: string }).code,
        status: error.status,
      })
      toast.error(messageErreurCode(error as { code?: string; status?: number }), {
        position: "top-right",
      })
      return
    }
    // Session de récupération ouverte : /reset-password affiche directement le
    // formulaire du nouveau mot de passe.
    router.push("/reset-password")
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
        Mot de passe oubli&eacute;
      </h2>

      {etape === "email" && (
        <>
          <form action={handleEmail} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                defaultValue={email}
              />
            </div>

            <Button type="submit" disabled={isPending} className="mt-2 w-full">
              {isPending ? "Envoi…" : "Recevoir un code"}
            </Button>
          </form>

          <button
            type="button"
            onClick={() => setEtape("code")}
            className="mt-4 w-full text-center text-sm font-medium text-primary hover:underline"
          >
            J&apos;ai d&eacute;j&agrave; re&ccedil;u un code
          </button>
        </>
      )}

      {etape === "code" && (
        <>
          <p className="mb-6 text-sm text-muted-foreground">
            Saisissez le code re&ccedil;u par email. Pensez &agrave; v&eacute;rifier vos courriers
            ind&eacute;sirables.
          </p>

          <form action={handleCode} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                defaultValue={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code re&ccedil;u par email</Label>
              <Input
                id="code"
                name="code"
                required
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="1234 5678"
                autoFocus
                maxLength={14}
                className="text-center font-mono text-lg tracking-[0.2em]"
              />
            </div>

            <Button type="submit" disabled={verifying} className="mt-2 w-full">
              {verifying ? "Vérification…" : "Valider le code"}
            </Button>
          </form>

          <div className="mt-4 flex justify-between text-sm">
            <button
              type="button"
              onClick={() => setEtape("email")}
              className="text-muted-foreground hover:text-primary hover:underline"
            >
              Changer d&apos;adresse
            </button>
            <button
              type="button"
              disabled={isPending || !email.trim()}
              onClick={() => envoyerCode(email.trim())}
              className="font-medium text-primary hover:underline disabled:opacity-50"
            >
              {isPending ? "Envoi…" : "Renvoyer un code"}
            </button>
          </div>
        </>
      )}

      <div className="mt-6 text-center">
        <Link
          href="/login"
          className="text-sm text-muted-foreground hover:text-primary hover:underline"
        >
          Retour &agrave; la connexion
        </Link>
      </div>
    </div>
  )
}
