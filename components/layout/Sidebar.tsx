"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  User,
  Briefcase,
  FileText,
  GraduationCap,
  TrendingUp,
  Users,
  BarChart3,
  Settings,
  X,
} from "lucide-react"
import { Separator } from "@/components/ui/separator"
import type { Permissions, NavItem, PermissionKey } from "@/types/database.types"
import type { LucideIcon } from "lucide-react"

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  User,
  Briefcase,
  FileText,
  GraduationCap,
  TrendingUp,
  Users,
  BarChart3,
  Settings,
}

const NAV_ITEMS: NavItem[] = [
  { label: "Accueil", href: "/dashboard", icon: "LayoutDashboard", permission: "dashboard" },
  { label: "Mon Profil", href: "/profil", icon: "User", permission: "profil" },
  { label: "Missions", href: "/missions", icon: "Briefcase", permission: "missions" },
  { label: "Mes Documents", href: "/documents", icon: "FileText", permission: "documents" },
  { label: "\u00c9tudes", href: "/etudes", icon: "GraduationCap", permission: "etudes" },
  { label: "Prospection", href: "/prospection", icon: "TrendingUp", permission: "prospection" },
  { label: "Membres", href: "/membres", icon: "Users", permission: "administration" },
  { label: "Statistiques", href: "/statistiques", icon: "BarChart3", permission: "statistiques" },
  { label: "Administration", href: "/administration", icon: "Settings", permission: "administration" },
]

interface SidebarProps {
  permissions: Permissions | null
  userName: string | null
  open?: boolean
  onClose?: () => void
}

export function Sidebar({ permissions, userName, open, onClose }: SidebarProps) {
  const pathname = usePathname()

  const filteredItems = NAV_ITEMS.filter(
    (item) => permissions && permissions[item.permission] === true
  )

  const nav = (
    <div className="flex flex-col h-screen w-[240px] bg-navy">
      <div className="p-6 flex items-center justify-between">
        <span className="font-heading text-gold text-xl font-bold">BeFast</span>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-ivory/70 hover:text-ivory">
            <X size={20} />
          </button>
        )}
      </div>
      <Separator className="border-white/10" />
      <nav className="flex-1 px-3 py-4 space-y-1 flex flex-col">
        <div className="flex-1 space-y-1">
          {filteredItems.map((item) => {
            const Icon = ICON_MAP[item.icon]
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 h-11 px-4 rounded-md text-base transition-colors ${
                  isActive
                    ? "bg-gold/20 text-gold font-medium"
                    : "text-ivory/70 hover:bg-white/5 hover:text-ivory"
                }`}
              >
                {Icon && (
                  <Icon
                    size={20}
                    className={isActive ? "text-gold" : ""}
                  />
                )}
                {item.label}
              </Link>
            )
          })}
        </div>

        {/* "New Mission" button — hidden for intervenants (only missions, no etudes/admin/prospection) */}
        {permissions && (permissions.etudes || permissions.administration || permissions.prospection) && (
          <Link
            href="/etudes/nouvelle"
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 h-10 px-4 rounded-md bg-gold/20 text-gold font-medium text-base hover:bg-gold/30 transition-colors mt-4"
          >
            <span className="text-lg leading-none">+</span>
            Nouvelle mission
          </Link>
        )}
      </nav>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:block shrink-0">{nav}</aside>

      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />
          <div className="relative">{nav}</div>
        </div>
      )}
    </>
  )
}
