/** Skeleton streaming — tampil seketika saat navigasi, sebelum data database siap. */
export default function KasirLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 space-y-2">
        <div className="h-7 w-48 rounded-lg bg-line/70" />
        <div className="h-4 w-72 max-w-full rounded-lg bg-line/50" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-2xl border border-line bg-surface p-4">
            <div className="h-3 w-20 rounded bg-line/60" />
            <div className="mt-3 h-6 w-28 rounded bg-line/80" />
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-72 rounded-2xl border border-line bg-surface p-5">
            <div className="h-4 w-40 rounded bg-line/60" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-9 rounded-lg bg-page" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
