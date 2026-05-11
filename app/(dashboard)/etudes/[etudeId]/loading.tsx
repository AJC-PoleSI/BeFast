import { Skeleton } from "@/components/ui/skeleton"

export default function EtudeDetailLoading() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <Skeleton className="h-8 w-32 rounded" />
      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-40" />
          </div>
          <Skeleton className="h-20 w-32" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  )
}
