"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "@/lib/actions/auth"

interface HeaderProps {
  userName: string | null
  onMenuToggle: () => void
}

export function Header({ userName, onMenuToggle }: HeaderProps) {
  const pathname = usePathname()

  const NAV_LINKS = [
    { label: "KPIs", href: "/dashboard" },
    { label: "Ressources", href: "/documents" },
    { label: "Rapports", href: "/statistiques" },
  ]

  // Get initials for avatar
  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U"

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 z-30">
      {/* LEFT - Home Button */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-4 py-2 bg-[#00236f] hover:bg-[#1e3a8a] text-white rounded-lg transition-colors font-semibold"
          title="Accueil"
        >
          <span className="material-symbols-outlined">home</span>
          <span>Accueil</span>
        </Link>
      </div>

      {/* CENTER - Title */}
      <div className="hidden sm:flex items-center">
        <span className="font-manrope font-black text-[#00236f] text-lg">BeFast Management</span>
      </div>

      {/* RIGHT - Logout Button */}
      <div className="flex items-center gap-4">
        <form action={signOut} className="">
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-semibold"
            title="Se déconnecter"
          >
            <span className="material-symbols-outlined">logout</span>
            <span>Déconnexion</span>
          </button>
        </form>
      </div>
    </header>
  )
}
