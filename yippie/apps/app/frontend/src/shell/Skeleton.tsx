// Shimmer placeholders shown while list queries load (perf Step 3 — perceived speed).

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200/80 ${className}`} />
}

/** Card-shaped placeholders matching the inbox/ticket list cards. */
export function CardListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-3/4 mb-1.5" />
          <Skeleton className="h-3 w-40" />
        </div>
      ))}
    </div>
  )
}

/** Row placeholders for table-style lists (contacts). */
export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <tbody className="divide-y divide-slate-100" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              {c === 0 ? (
                <div className="flex items-center gap-2.5">
                  <Skeleton className="w-7 h-7 rounded-full flex-shrink-0" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : (
                <Skeleton className="h-4 w-24" />
              )}
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  )
}
