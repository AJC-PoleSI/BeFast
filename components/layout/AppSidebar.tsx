"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
// LazyMotion + m : ne charge que le sous-ensemble domAnimation de framer-motion
// (la sidebar est dans le layout, donc dans le bundle de toutes les pages).
import { AnimatePresence, LazyMotion, domAnimation, m } from "framer-motion"
import {
  BarChart3,
  Briefcase,
  ChevronsUpDown,
  FileSignature,
  FolderOpen,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Rocket,
  Settings,
  Shield,
  Sun,
  TrendingUp,
  UserCircle,
  Wallet,
  X,
} from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useUser } from "@/hooks/useUser"
import type { Permissions } from "@/types/database.types"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type IconType = React.ComponentType<{ className?: string }>

interface NavEntry {
  label: string
  href: string
  icon: IconType
  permission: keyof Permissions
  adminOnly?: boolean
}

const NAV: NavEntry[] = [
  { label: "Accueil", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard" },
  { label: "Mon profil", href: "/profil", icon: UserCircle, permission: "profil" },
  { label: "Missions", href: "/missions", icon: Briefcase, permission: "missions" },
  { label: "Mes documents", href: "/documents", icon: FolderOpen, permission: "documents" },
  { label: "Études", href: "/etudes", icon: GraduationCap, permission: "etudes" },
  { label: "Prospection", href: "/prospection", icon: TrendingUp, permission: "prospection" },
  { label: "Trésorerie", href: "/tresorerie", icon: Wallet, permission: "voir_factures" },
  { label: "Signatures", href: "/signatures", icon: FileSignature, permission: "etudes" },
  { label: "Statistiques", href: "/statistiques", icon: BarChart3, permission: "statistiques" },
  { label: "Administration", href: "/administration", icon: Shield, permission: "administration", adminOnly: true },
]

const sidebarVariants = {
  open: { width: "15rem" },
  closed: { width: "3.05rem" },
}

const labelVariants = {
  open: {
    x: 0,
    opacity: 1,
    transition: { x: { stiffness: 1000, velocity: -100 } },
  },
  closed: {
    x: -16,
    opacity: 0,
    transition: { x: { stiffness: 100 } },
  },
}

const transitionProps = {
  type: "tween",
  ease: "easeOut",
  duration: 0.2,
  staggerChildren: 0.1,
} as const

const staggerVariants = {
  open: { transition: { staggerChildren: 0.03, delayChildren: 0.02 } },
}

interface AppSidebarProps {
  permissions: Permissions | null
  isAdmin?: boolean
  userName: string | null
}

export function AppSidebar({ permissions, isAdmin, userName }: AppSidebarProps) {
  const pathname = usePathname()
  const { profile } = useUser()
  const { resolvedTheme, setTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)

  const items = NAV.filter((item) => {
    if (item.adminOnly) return !!isAdmin
    if (isAdmin) return true
    return permissions?.[item.permission] === true
  })

  const email = profile?.email ?? null
  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U"

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/")

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }

  const navLinks = (collapsed: boolean, onNavigate?: () => void) => (
    <div className="flex w-full flex-col gap-1">
      {items.map((item) => {
        const active = isActive(item.href)
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex h-9 w-full flex-row items-center rounded-md px-2.5 transition-colors hover:bg-accent hover:text-foreground",
              active
                ? "bg-muted font-medium text-primary"
                : "text-muted-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && (
              <m.span
                variants={labelVariants}
                className="ml-2 truncate text-sm"
              >
                {item.label}
              </m.span>
            )}
          </Link>
        )
      })}
    </div>
  )

  const footer = (collapsed: boolean, onNavigate?: () => void) => (
    <div className="flex flex-col gap-1 p-2">
      {/* Icônes soleil/lune pilotées en CSS (dark:) pour éviter tout
          mismatch d'hydratation avec next-themes. */}
      <button
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="flex h-9 w-full flex-row items-center rounded-md px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Sun className="h-4 w-4 shrink-0 dark:hidden" />
        <Moon className="hidden h-4 w-4 shrink-0 dark:block" />
        {!collapsed && (
          <m.span variants={labelVariants} className="ml-2 text-sm">
            <span className="dark:hidden">Mode sombre</span>
            <span className="hidden dark:inline">Mode clair</span>
          </m.span>
        )}
      </button>
      <Link
        href="/parametres"
        onClick={onNavigate}
        className="flex h-9 w-full flex-row items-center rounded-md px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Settings className="h-4 w-4 shrink-0" />
        {!collapsed && (
          <m.span variants={labelVariants} className="ml-2 text-sm">
            Paramètres
          </m.span>
        )}
      </Link>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger className="w-full outline-none">
          <div className="flex h-9 w-full flex-row items-center gap-2 rounded-md px-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            <Avatar className="size-5 shrink-0">
              <AvatarFallback className="bg-primary text-[10px] font-semibold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <m.div
                variants={labelVariants}
                className="flex w-full items-center gap-2"
              >
                <span className="truncate text-sm font-medium text-foreground">
                  {userName ?? "Mon compte"}
                </span>
                <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground/60" />
              </m.div>
            )}
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" side="top" sideOffset={6} className="w-56">
          <div className="flex items-center gap-2 p-2">
            <Avatar className="size-8">
              <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col text-left">
              <span className="truncate text-sm font-medium">
                {userName ?? "Compte"}
              </span>
              {email && (
                <span className="truncate text-xs text-muted-foreground">
                  {email}
                </span>
              )}
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profil" onClick={onNavigate}>
              <UserCircle className="h-4 w-4" /> Mon profil
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={handleSignOut}
            className="text-destructive focus:bg-destructive/10 focus:text-destructive"
          >
            <LogOut className="h-4 w-4" /> Déconnexion
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )

  const brand = (collapsed: boolean) => (
    <div className="flex h-[54px] shrink-0 items-center gap-2 border-b px-2.5">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Rocket className="h-4 w-4" />
      </div>
      {!collapsed && (
        <m.div variants={labelVariants} className="flex flex-col leading-tight">
          <span className="font-manrope text-sm font-extrabold text-primary">
            BeFast
          </span>
          <span className="text-[10px] font-medium tracking-wide text-muted-foreground">
            Audencia Junior Conseil
          </span>
        </m.div>
      )}
    </div>
  )

  return (
    <LazyMotion features={domAnimation} strict>
      {/* ── Desktop : rail fixe qui s'étend au survol ─────────────────── */}
      <m.aside
        className="fixed left-0 top-0 z-40 hidden h-full shrink-0 overflow-hidden border-r bg-card lg:block"
        initial="closed"
        animate="closed"
        whileHover="open"
        variants={sidebarVariants}
        transition={transitionProps}
      >
        <m.div
          variants={staggerVariants}
          className="flex h-full flex-col text-muted-foreground"
        >
          {/* Les labels restent montés : leur opacité/position sont pilotées
              par labelVariants selon l'état (replié/survol) du rail. */}
          {brand(false)}
          <div className="flex grow flex-col overflow-hidden">
            <ScrollArea className="grow p-2">{navLinks(false)}</ScrollArea>
          </div>
          {footer(false)}
        </m.div>
      </m.aside>

      {/* ── Mobile : barre fine + drawer ──────────────────────────────── */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-14 items-center gap-2 border-b bg-card px-3 lg:hidden">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Ouvrir le menu"
          className="flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Rocket className="h-3.5 w-3.5" />
          </div>
          <span className="font-manrope text-sm font-extrabold text-primary">
            BeFast
          </span>
        </div>
      </div>

      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
            />
            <m.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", ease: "easeOut", duration: 0.25 }}
              className="absolute left-0 top-0 flex h-full w-64 flex-col border-r bg-card text-muted-foreground"
            >
              <div className="flex h-[54px] shrink-0 items-center justify-between border-b px-3">
                <div className="flex items-center gap-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                    <Rocket className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col leading-tight">
                    <span className="font-manrope text-sm font-extrabold text-primary">
                      BeFast
                    </span>
                    <span className="text-[10px] font-medium tracking-wide text-muted-foreground">
                      Audencia Junior Conseil
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Fermer le menu"
                  className="flex size-8 items-center justify-center rounded-lg hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="grow overflow-y-auto p-2">
                {navLinks(false, () => setMobileOpen(false))}
              </div>
              <Separator />
              {footer(false, () => setMobileOpen(false))}
            </m.aside>
          </div>
        )}
      </AnimatePresence>
    </LazyMotion>
  )
}
