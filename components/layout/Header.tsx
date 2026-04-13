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
    <header className="fixed top-0 right-0 h-16 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-6 z-30"
      style={{ width: "calc(100% - 16rem)" }}>
      {/* Left */}
      <div className="flex items-center gap-2">
        {/* Menu toggle button (always visible) */}
        <button
          onClick={onMenuToggle}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-[#00236f] transition-colors"
          aria-label="Menu"
          title="Retourner au menu"
        >
          <span className="material-symbols-outlined text-xl">menu</span>
        </button>

        {/* Home button */}
        <Link
          href="/dashboard"
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-[#00236f] transition-colors"
          title="Accueil"
        >
          <span className="material-symbols-outlined text-xl">home</span>
        </Link>

        <span className="font-manrope font-black text-[#00236f] text-lg hidden sm:block">BeFast Management</span>

        {/* Search */}
        <div className="relative hidden md:block">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
          <input
            type="search"
            placeholder="Rechercher..."
            className="h-9 pl-9 pr-4 rounded-full bg-slate-100 border-0 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#00236f]/20 w-56"
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1">
        {/* Nav links */}
        <nav className="hidden lg:flex items-center gap-1 mr-3">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "text-[#00236f] bg-[#d0d8ff]"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Notifications */}
        <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
          <span className="material-symbols-outlined text-xl">notifications</span>
        </button>

        {/* Chat */}
        <button className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
          <span className="material-symbols-outlined text-xl">chat_bubble_outline</span>
        </button>

        {/* User profile + logout section */}
        <div className="flex items-center gap-3 ml-3 pl-3 border-l border-slate-200">
          {/* User info */}
          <div className="text-right hidden sm:block">
            {userName && (
              <div className="text-sm text-slate-700 font-medium">{userName}</div>
            )}
          </div>

          {/* User avatar */}
          <div className="w-8 h-8 rounded-full bg-[#00236f] flex items-center justify-center text-white text-xs font-bold font-manrope">
            {initials}
          </div>

          {/* Logout button */}
          <form action={signOut} className="">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 transition-colors text-sm font-medium"
              title="Se déconnecter"
            >
              <span className="material-symbols-outlined text-base">logout</span>
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </form>
        </div>
      </div>
    </header>
  )
}
