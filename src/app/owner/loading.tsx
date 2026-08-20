/** Skeleton streaming — tampil seketika saat navigasi, sebelum data database siap. */
export default function OwnerLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 space-y-2">
        <div className="h-7 w-56 rounded-lg bg-line/70" />
        <div className="h-4 w-80 max-w-full rounded-lg bg-line/50" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-line bg-surface p-4">
            <div className="h-3 w-16 rounded bg-line/60" />
            <div className="mt-3 h-6 w-24 rounded bg-line/80" />
            <div className="mt-2 h-3 w-20 rounded bg-line/40" />
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-80 rounded-2xl border border-line bg-surface p-5">
            <div className="h-4 w-40 rounded bg-line/60" />
            <div className="mt-4 h-56 rounded-xl bg-page" />
          </div>
        ))}
      </div>
    </div>
  );
}
