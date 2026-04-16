import { RoleGuard } from "@/components/layout/RoleGuard"

export default function MembresLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RoleGuard permission="membres">
      {children}
    </RoleGuard>
  )
}
