"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Settings, FileText, Users, Database } from "lucide-react"

// 4 sections claires — les anciens onglets (Droits, Campagne mdp, Champs
// personnalisés, Import/Export) sont devenus des onglets internes de
// « Membres & Droits » et « Données ». Les anciennes URLs redirigent.
const ADMIN_NAV_LINKS = [
  {
    href: "/administration",
    label: "Paramètres",
    description: "Structure, bureau, banque, cotisations",
    icon: Settings,
  },
  {
    href: "/administration/membres",
    label: "Membres & Droits",
    description: "Comptes, rôles, permissions, campagne mdp",
    icon: Users,
  },
  {
    href: "/administration/documents",
    label: "Modèles de documents",
    description: "Templates Word / PDF et balises",
    icon: FileText,
  },
  {
    href: "/administration/donnees",
    label: "Données",
    description: "Explorateur et exports CSV",
    icon: Database,
  },
]

// Anciennes routes rattachées à leur nouvelle section pour l'état actif.
const LEGACY_ACTIVE: Record<string, string> = {
  "/administration/droits": "/administration/membres",
  "/administration/campagne-mdp": "/administration/membres",
  "/administration/champs-personnalises": "/administration/membres",
  "/administration/import-export": "/administration/donnees",
}

export function AdminSidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === "/administration") {
      return pathname === "/administration" || pathname === "/administration/parametres"
    }
    if (pathname.startsWith(href)) return true
    const mapped = Object.entries(LEGACY_ACTIVE).find(([legacy]) => pathname.startsWith(legacy))
    return mapped ? mapped[1] === href : false
  }

  return (
    <nav className="w-64 shrink-0 pr-8 hidden md:block">
      <div className="mb-6">
        <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-wider mb-2">
          Administration
        </h2>
        <p className="text-xs text-zinc-500">
          Gérez votre structure de Junior-Entreprise
        </p>
      </div>

      <div className="space-y-1.5">
        {ADMIN_NAV_LINKS.map((link) => {
          const Icon = link.icon
          const active = isActive(link.href)

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                active
                  ? "bg-[#00236f] text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${active ? "text-white" : "text-zinc-400"}`} />
              <span className="min-w-0">
                <span className="block text-sm font-medium leading-tight">{link.label}</span>
                <span
                  className={`block text-[11px] leading-tight mt-0.5 ${
                    active ? "text-white/70" : "text-zinc-400"
                  }`}
                >
                  {link.description}
                </span>
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
