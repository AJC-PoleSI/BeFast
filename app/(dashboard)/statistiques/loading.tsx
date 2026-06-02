import { Skeleton } from "@/components/ui/skeleton"

export default function StatistiquesLoading() {
  return (
    <div className="p-8 space-y-8">
      {/* En-tête */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* Grille de KPI (4 colonnes) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm p-5 space-y-3"
          >
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>

      {/* Section secondaire (3 colonnes) */}
      <div className="space-y-5">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  )
}
