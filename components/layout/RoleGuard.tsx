"use client"

import { useUser } from "@/hooks/useUser"
import { Skeleton } from "@/components/ui/skeleton"
import type { PermissionKey } from "@/types/database.types"

interface RoleGuardProps {
  permission?: PermissionKey
  requireAdmin?: boolean
  children: React.ReactNode
}

export function RoleGuard({ permission, requireAdmin, children }: RoleGuardProps) {
  const { permissions, loading, isAdmin } = useUser()

  if (loading) {
    return (
      <div className="space-y-4 p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-4 w-72" />
      </div>
    )
  }

  if (requireAdmin && !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="font-heading text-[20px] font-bold mb-2">
            Acc&egrave;s non autoris&eacute;
          </h2>
          <p className="text-muted-foreground">
            Espace r&eacute;serv&eacute; aux administrateurs.
          </p>
        </div>
      </div>
    )
  }

  if (permission && (!permissions || permissions[permission] !== true)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h2 className="font-heading text-[20px] font-bold mb-2">
            Acc&egrave;s non autoris&eacute;
          </h2>
          <p className="text-muted-foreground">
            Vous n&apos;avez pas les permissions pour acc&eacute;der &agrave; cette page.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
