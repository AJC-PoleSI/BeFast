"use client"

import { AppSidebar } from "@/components/layout/AppSidebar"
import { GlowLayer } from "@/components/ui/background-glow"
import type { Permissions } from "@/types/database.types"

interface DashboardShellProps {
  permissions: Permissions | null
  isAdmin?: boolean
  userName: string | null
  children: React.ReactNode
}

export function DashboardShell({
  permissions,
  isAdmin,
  userName,
  children,
}: DashboardShellProps) {
  return (
    <div className="relative min-h-screen bg-[#f7f9fb]">
      <AppSidebar permissions={permissions} isAdmin={isAdmin} userName={userName} />

      {/* Décalage : barre mobile (top) et rail réduit (gauche, desktop) */}
      <div className="flex min-h-screen flex-col pt-14 lg:pl-[3.05rem] lg:pt-0">
        <main className="relative flex-1">
          <GlowLayer />
          <div className="relative z-10 mx-auto max-w-7xl px-6 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
