"use client"

import { useTransition } from "react"
import Link from "next/link"
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
    <div className="w-full max-w-[400px] bg-[#F5F0E8] border border-[hsl(210,20%,82%)] rounded-lg shadow-md p-12">
      <div className="text-center mb-8">
        <h1 className="font-heading text-[28px] font-bold tracking-[-0.01em]">
          <span className="text-gold">BeFast</span>
        </h1>
      </div>

      <h2 className="font-heading text-[28px] font-bold tracking-[-0.01em] text-center mb-8">
        Cr&eacute;er un compte
      </h2>

      <form action={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="prenom">Pr&eacute;nom</Label>
          <Input id="prenom" name="prenom" type="text" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="nom">Nom</Label>
          <Input id="nom" name="nom" type="text" required />
        </div>

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

        <Button
          type="submit"
          disabled={isPending}
          className="w-full h-11 bg-gold text-navy font-bold rounded-md hover:bg-gold/90"
        >
          {isPending ? "Cr\u00e9ation..." : "Cr\u00e9er mon compte"}
        </Button>
      </form>

      <p className="mt-4 text-sm text-muted-foreground text-center">
        Votre compte sera activ&eacute; apr&egrave;s validation par un administrateur.
      </p>

      <div className="mt-4 text-center">
        <Link
          href="/login"
          className="text-blue text-sm hover:underline"
        >
          D&eacute;j&agrave; un compte ? Se connecter
        </Link>
      </div>
    </div>
  )
}
