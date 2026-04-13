"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { Permissions, NavItem } from "@/types/database.types"

const NAV_ITEMS: (NavItem & { materialIcon: string })[] = [
  { label: "Accueil", href: "/dashboard", icon: "LayoutDashboard", materialIcon: "dashboard", permission: "dashboard" },
  { label: "Mon Profil", href: "/profil", icon: "User", materialIcon: "person", permission: "profil" },
  { label: "Missions", href: "/missions", icon: "Briefcase", materialIcon: "assignment", permission: "missions" },
  { label: "Mes Documents", href: "/documents", icon: "FileText", materialIcon: "folder_open", permission: "documents" },
  { label: "Études", href: "/etudes", icon: "GraduationCap", materialIcon: "school", permission: "etudes" },
  { label: "Prospection", href: "/prospection", icon: "TrendingUp", materialIcon: "timeline", permission: "prospection" },
  { label: "Membres", href: "/administration/membres", icon: "Users", materialIcon: "group", permission: "administration" },
  { label: "Statistiques", href: "/administration/statistiques", icon: "BarChart3", materialIcon: "bar_chart", permission: "statistiques" },
  { label: "Administration", href: "/administration", icon: "Settings", materialIcon: "admin_panel_settings", permission: "administration" },
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
    <div className="flex flex-col h-screen w-64 bg-slate-100 border-r border-slate-200">
      {/* Logo */}
      <div className="px-5 py-5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#00236f] flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-white text-xl">rocket_launch</span>
        </div>
        <div>
          <div className="font-manrope font-extrabold text-[#00236f] text-base leading-tight">BeFast</div>
          <div className="text-[10px] text-slate-500 font-medium tracking-wide leading-tight">Strategic Command</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden ml-auto text-slate-400 hover:text-slate-600">
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-2 flex flex-col gap-0.5 overflow-y-auto">
        {filteredItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={`flex items-center gap-3 py-3 pl-4 pr-3 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-slate-200 text-[#00236f] font-semibold border-l-4 border-[#00236f]"
                  : "text-slate-600 hover:bg-slate-200 hover:text-slate-900 border-l-4 border-transparent"
              }`}
            >
              <span className={`material-symbols-outlined text-xl ${isActive ? "text-[#00236f]" : "text-slate-500"}`}>
                {item.materialIcon}
              </span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-3 pb-5 space-y-2">
        {/* Nouvelle mission */}
        {permissions && permissions.nouvelle_mission && (
          <Link
            href="/etudes/nouvelle"
            onClick={onClose}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#00236f] to-[#1e3a8a] text-white text-sm font-semibold font-manrope hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            Nouvelle mission
          </Link>
        )}

        <Link
          href="/parametres"
          className="flex items-center gap-3 py-2.5 pl-4 pr-3 rounded-lg text-sm text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">settings</span>
          Paramètres
        </Link>

        <Link
          href="/support"
          className="flex items-center gap-3 py-2.5 pl-4 pr-3 rounded-lg text-sm text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"
        >
          <span className="material-symbols-outlined text-xl">help_outline</span>
          Support
        </Link>
      </div>
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
