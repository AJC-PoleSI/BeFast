import Link from "next/link"

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#f7f9fb]">
      <div className="text-center space-y-6">
        <div>
          <h1 className="text-4xl font-black text-[#00236f] mb-2">BeFast</h1>
          <p className="text-zinc-600">Plateforme de gestion interne</p>
        </div>

        <div className="space-y-3">
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-[#00236f] hover:bg-[#1e3a8a] text-white rounded-lg font-semibold transition-colors"
          >
            Se connecter
          </Link>

          <div>
            <Link
              href="/inscription"
              className="inline-block px-6 py-3 border border-[#00236f] text-[#00236f] hover:bg-[#00236f] hover:text-white rounded-lg font-semibold transition-colors"
            >
              Créer un compte
            </Link>
          </div>

          <div className="text-sm text-zinc-600">
            <Link href="/diagnostic" className="text-blue-600 hover:underline">
              Diagnostic →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
