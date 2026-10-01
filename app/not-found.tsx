import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-sm font-semibold text-[#00236f]">Erreur 404</p>
      <h1 className="text-2xl font-bold text-zinc-900">Page introuvable</h1>
      <p className="max-w-md text-sm text-zinc-500">
        La page que vous cherchez n'existe pas ou a été déplacée.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-lg bg-[#00236f] px-4 py-2 text-sm font-semibold text-white hover:bg-[#00236f]/90"
      >
        Retour à l'accueil
      </Link>
    </div>
  )
}
