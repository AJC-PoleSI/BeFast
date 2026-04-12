"use client"

import Link from "next/link"
import { Menu, LogOut, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOut } from "@/lib/actions/auth"

interface HeaderProps {
  userName: string | null
  onMenuToggle: () => void
}

export function Header({ userName, onMenuToggle }: HeaderProps) {
  return (
    <header className="h-14 bg-white border-b border-border flex items-center justify-between px-4">
      <div className="flex items-center gap-2">
        {/* Home button */}
        <Link
          href="/dashboard"
          className="p-2 rounded-md hover:bg-gray-100 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Accueil"
        >
          <Home size={20} />
        </Link>

        {/* Mobile menu toggle */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-md hover:bg-gray-100"
          aria-label="Menu"
        >
          <Menu size={20} />
        </button>
      </div>

      <div className="flex items-center gap-4">
        {userName && (
          <span className="text-sm text-foreground">{userName}</span>
        )}
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            aria-label="Se d&eacute;connecter"
          >
            <LogOut size={18} />
          </Button>
        </form>
      </div>
    </header>
  )
}
