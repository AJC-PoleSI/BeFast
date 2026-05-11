import { Skeleton } from "@/components/ui/skeleton"

export default function MissionDetailLoading() {
  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Skeleton className="h-8 w-32 rounded" />
      <div className="bg-white rounded-xl border border-zinc-200 p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 flex-1">
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <Skeleton className="h-8 w-80" />
            <Skeleton className="h-16 w-full" />
          </div>
          <Skeleton className="h-14 w-14 rounded-xl" />
        </div>
      </div>
      <Skeleton className="h-48 rounded-xl" />
    </div>
  )
}
