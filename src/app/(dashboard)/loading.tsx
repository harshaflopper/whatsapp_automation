export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="mb-3 h-4 w-28 rounded-full bg-muted" />
      <div className="mb-8 h-8 w-64 rounded-xl bg-muted" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="surface h-32" />
        ))}
      </div>
      <div className="surface h-80" />
    </div>
  );
}
