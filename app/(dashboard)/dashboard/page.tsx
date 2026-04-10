"use client"

import { useUser } from "@/hooks/useUser"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardPage() {
  const { profile, loading } = useUser()

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="font-heading text-[20px] font-bold mb-4">
        Tableau de bord
      </h1>
      <p className="text-base text-muted-foreground">
        Bonjour, {profile?.prenom ?? ""}
      </p>
      <div className="mt-8 rounded-lg border border-border bg-white p-6">
        <p className="text-muted-foreground">Bienvenue sur BeFast</p>
      </div>
    </div>
  )
}
