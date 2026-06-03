"use client"

import { useTransition } from "react"
import { resendVerification } from "@/lib/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export function ResendForm() {
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await resendVerification(formData)
      if (res?.success) {
        toast.success(res.success, { duration: 6000, position: "top-right" })
      }
    })
  }

  return (
    <form action={handleSubmit} className="space-y-3">
      <Input
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="Votre adresse email"
      />
      <Button
        type="submit"
        disabled={isPending}
        variant="outline"
        className="w-full h-11 font-semibold"
      >
        {isPending ? "Envoi..." : "Renvoyer l'email de vérification"}
      </Button>
    </form>
  )
}
