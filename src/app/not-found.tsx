import Link from "next/link";

export default function NotFound() {
  return (
    <main className="terrain-grid flex min-h-screen items-center justify-center px-4 py-10">
      <div className="glass-panel max-w-lg rounded-[32px] border border-[var(--line)] p-8 text-center">
        <div className="font-mono text-sm uppercase tracking-[0.2em] text-[var(--muted)]">
          Missing route
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">
          This QR code does not map to a known location.
        </h1>
        <p className="mt-4 text-base leading-7 text-[var(--muted)]">
          Check the printed code or go back to the main map to pick an active point.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-[var(--accent)] px-5 py-3 font-medium text-white transition hover:bg-[var(--accent-strong)]"
        >
          Return to HQ map
        </Link>
      </div>
    </main>
  );
}