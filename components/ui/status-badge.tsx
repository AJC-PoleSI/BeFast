import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type Status = "ouverte" | "en_cours" | "terminee" | "annulee" | "en_attente"

const statusConfig: Record<Status, { label: string; className: string }> = {
  ouverte: { label: "Ouverte", className: "bg-green-100 text-green-800" },
  en_cours: { label: "En cours", className: "bg-blue-100 text-blue-800" },
  terminee: { label: "Termin\u00e9e", className: "bg-gray-100 text-gray-700" },
  annulee: { label: "Annul\u00e9e", className: "bg-red-100 text-red-700" },
  en_attente: { label: "En attente", className: "bg-orange-100 text-orange-800" },
}

interface StatusBadgeProps {
  status: Status
  children?: React.ReactNode
}

export function StatusBadge({ status, children }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <Badge
      variant="secondary"
      className={cn(
        "border-0 font-normal",
        config.className
      )}
    >
      {children ?? config.label}
    </Badge>
  )
}
