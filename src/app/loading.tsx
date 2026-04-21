export default function Loading() {
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-center">
        <div className="glass-panel w-full rounded-[28px] border border-[var(--line)] p-8 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Načítání stránky...
          </p>
          <div className="mx-auto mt-4 h-2 w-48 overflow-hidden rounded-full bg-white/60">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-[var(--accent)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
