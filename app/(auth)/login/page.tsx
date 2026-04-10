"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { signIn } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"

export default function LoginPage() {
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await signIn(formData)
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
        Connexion
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

        <Button
          type="submit"
          disabled={isPending}
          className="w-full h-11 bg-gold text-navy font-bold rounded-md hover:bg-gold/90"
        >
          {isPending ? "Connexion..." : "Se connecter"}
        </Button>
      </form>

      <div className="mt-6 text-center space-y-2">
        <Link
          href="/mot-de-passe-oublie"
          className="block text-blue text-sm hover:underline"
        >
          Mot de passe oubli&eacute; ?
        </Link>
        <Link
          href="/inscription"
          className="block text-blue text-sm hover:underline"
        >
          Pas encore de compte ? S&apos;inscrire
        </Link>
      </div>
    </div>
  )
}
