"use client"

import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[GlobalError]", error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-semibold text-red-600">Une erreur est survenue</p>
      <h1 className="text-2xl font-bold text-zinc-900">Quelque chose s'est mal passé</h1>
      <p className="max-w-md text-sm text-zinc-500">
        L'équipe technique a été notifiée. Vous pouvez réessayer ou revenir à l'accueil.
      </p>
      <div className="mt-2 flex gap-3">
        <button
          onClick={() => reset()}
          className="rounded-lg bg-[#00236f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00236f]/90"
        >
          Réessayer
        </button>
        <a
          href="/"
          className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          Retour à l'accueil
        </a>
      </div>
    </div>
  )
}
