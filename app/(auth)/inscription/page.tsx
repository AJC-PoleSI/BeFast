"use client"

import { useTransition } from "react"
import Link from "next/link"
import { Rocket } from "lucide-react"
import { signUp } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function InscriptionPage() {
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await signUp(formData)
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
        Créer un compte
      </h2>

      <form action={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="prenom">Prénom</Label>
            <Input id="prenom" name="prenom" type="text" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nom">Nom</Label>
            <Input id="nom" name="nom" type="text" required />
          </div>
        </div>

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
          <p className="text-xs text-muted-foreground">
            Seules les adresses @audencia.com sont autorisées.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
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

        <Button type="submit" disabled={isPending} className="mt-2 w-full">
          {isPending ? "Création…" : "Créer mon compte"}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Un email de vérification vous sera envoyé. Après confirmation, votre
        compte sera activé par un administrateur.
      </p>

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Se connecter
        </Link>
      </p>
    </div>
  )
}
