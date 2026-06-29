export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="h-7 w-64 animate-pulse rounded-md bg-muted" />
        <div className="h-4 w-96 max-w-full animate-pulse rounded bg-muted/70" />
      </div>
      <div className="flex gap-2 border-b pb-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-8 w-40 animate-pulse rounded bg-muted/70" />
        ))}
      </div>
      <div className="rounded-2xl border bg-card p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-md bg-muted/60" />
          ))}
        </div>
      </div>
    </div>
  )
}
