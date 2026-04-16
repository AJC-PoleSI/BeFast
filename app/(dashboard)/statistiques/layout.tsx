import { RoleGuard } from "@/components/layout/RoleGuard"

export default function StatistiquesLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RoleGuard permission="statistiques">
      {children}
    </RoleGuard>
  )
}
