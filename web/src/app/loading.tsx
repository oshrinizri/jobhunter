// Skeleton shown while a screen's data streams in.
export default function Loading() {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true" aria-label="טוען">
      <div className="h-7 w-32 rounded-lg bg-surface-2" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-2xl border border-border bg-surface p-4">
          <div className="h-12 w-12 rounded-2xl bg-surface-2" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-surface-2" />
            <div className="h-3 w-1/3 rounded bg-surface-2" />
          </div>
        </div>
      ))}
    </div>
  );
}
