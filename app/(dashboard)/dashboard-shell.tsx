"use client"

import { useState } from "react"
import { Sidebar } from "@/components/layout/Sidebar"
import { Header } from "@/components/layout/Header"
import type { Permissions } from "@/types/database.types"

interface DashboardShellProps {
  permissions: Permissions | null
  userName: string | null
  children: React.ReactNode
}

export function DashboardShell({
  permissions,
  userName,
  children,
}: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen">
      <Sidebar
        permissions={permissions}
        userName={userName}
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          userName={userName}
          onMenuToggle={() => setSidebarOpen(!sidebarOpen)}
        />
        <main className="flex-1 overflow-y-auto bg-[#F5F0E8] p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
