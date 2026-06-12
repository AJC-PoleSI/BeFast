"use client"

import { useTransition } from "react"
import Link from "next/link"
import { Rocket } from "lucide-react"
import { resetPassword } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function MotDePasseOubliePage() {
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await resetPassword(formData)
      if (result?.error) {
        toast.error(result.error, { duration: 5000, position: "top-right" })
      }
      if (result?.success) {
        toast.success(result.success, {
          duration: 5000,
          position: "top-right",
        })
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
        Mot de passe oubli&eacute;
      </h2>

      <form action={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
        </div>

        <Button type="submit" disabled={isPending} className="mt-2 w-full">
          {isPending ? "Envoi…" : "Envoyer le lien"}
        </Button>
      </form>

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
