import { Skeleton } from "@/components/ui/skeleton"

export default function EtudesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-7 w-28 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <Skeleton className="h-96 lg:col-span-8 rounded-xl" />
        <Skeleton className="h-96 lg:col-span-4 rounded-xl" />
      </div>
    </div>
  )
}
