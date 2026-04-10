"use client"

import { Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/actions/auth"

export default function AttentePage() {
  return (
    <div className="min-h-screen bg-navy flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] bg-[#F5F0E8] border border-[hsl(210,20%,82%)] rounded-lg shadow-md p-12 text-center">
        <Clock className="mx-auto mb-6 text-gold" size={48} />

        <h1 className="font-heading text-[20px] font-bold tracking-[-0.01em] mb-4">
          Compte en attente de validation
        </h1>

        <p className="text-base text-muted-foreground mb-8">
          Votre compte a &eacute;t&eacute; cr&eacute;&eacute;. Un administrateur vous assignera un
          r&ocirc;le prochainement. Vous recevrez un acc&egrave;s d&egrave;s que votre profil
          sera activ&eacute;.
        </p>

        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            className="text-blue text-sm"
          >
            Se d&eacute;connecter
          </Button>
        </form>
      </div>
    </div>
  )
}
