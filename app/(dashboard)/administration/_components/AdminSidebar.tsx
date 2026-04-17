"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { 
  ShieldCheck, 
  Settings, 
  FileText, 
  BarChart4, 
  ArrowDownUp, 
  Users, 
  Briefcase 
} from "lucide-react"

const ADMIN_NAV_LINKS = [
  { href: "/administration", label: "Structure", icon: Settings },
  { href: "/administration/membres", label: "Membres & Validation", icon: Users },
  { href: "/administration/droits", label: "Droits & Profils", icon: ShieldCheck },
  { href: "/administration/documents", label: "Modèles de Documents", icon: FileText },
  { href: "/administration/clients", label: "Gestion Clients", icon: Briefcase },
  { href: "/administration/import-export", label: "Import / Export", icon: ArrowDownUp },
]

export function AdminSidebar() {
  const pathname = usePathname()

  // On considère la route /administration pour les paramètres (ou par défaut)
  // et les autres comme sous-routes.
  const isActive = (href: string) => {
    if (href === "/administration") {
      return pathname === "/administration" || pathname === "/administration/parametres"
    }
    return pathname.startsWith(href)
  }

  return (
    <nav className="w-64 shrink-0 pr-8 hidden md:block">
      <div className="mb-6">
        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-2">
          Administration
        </h2>
        <p className="text-xs text-slate-500">
          Gérez votre structure de Junior-Entreprise
        </p>
      </div>

      <div className="space-y-1">
        {ADMIN_NAV_LINKS.map((link) => {
          const Icon = link.icon
          const active = isActive(link.href)

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-[#00236f] text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              {link.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
