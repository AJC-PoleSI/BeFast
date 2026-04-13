"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "@/lib/actions/auth"
import { useState, useRef, useEffect } from "react"

interface HeaderProps {
  userName: string | null
  onMenuToggle: () => void
}

export function Header({ userName, onMenuToggle }: HeaderProps) {
  const pathname = usePathname()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Get initials for avatar
  const initials = userName
    ? userName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : "U"

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

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

      {/* RIGHT - User Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          title="Mon compte"
        >
          {/* Avatar circle */}
          <div className="w-8 h-8 rounded-full bg-[#00236f] flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <span className="text-sm font-medium text-slate-700 hidden sm:block">
            {userName || "Mon compte"}
          </span>
          <span className="material-symbols-outlined text-slate-400 text-sm">
            {dropdownOpen ? "expand_less" : "expand_more"}
          </span>
        </button>

        {/* Dropdown menu */}
        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-52 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50">
            {/* Profile link */}
            <Link
              href="/profil"
              onClick={() => setDropdownOpen(false)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[#00236f] text-lg">person</span>
              <span className="text-sm font-medium text-slate-700">Mon profil</span>
            </Link>

            <div className="border-t border-slate-100" />

            {/* Logout */}
            <form action={signOut}>
              <button
                type="submit"
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition-colors text-left"
              >
                <span className="material-symbols-outlined text-red-500 text-lg">logout</span>
                <span className="text-sm font-medium text-red-600">Déconnexion</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  )
}
