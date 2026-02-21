export function SummaryCardsSkeleton() {
  return (
    <div className="mb-4 grid gap-4 md:grid-cols-3">
      {[0, 1, 2].map((key) => (
        <div key={key} className="rounded-xl border bg-white p-5">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-200" />
          <div className="mt-4 h-8 w-28 animate-pulse rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

export function FilterBarSkeleton() {
  return (
    <div className="mb-4 rounded-xl border bg-white p-4">
      <div className="grid gap-3 md:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-9 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <div className="mb-3 h-5 w-40 animate-pulse rounded bg-slate-200" />
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="h-8 w-full animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    </div>
  );
}
