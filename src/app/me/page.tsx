import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { USER_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth";
import { db } from "@/lib/db";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export default async function MePage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;
  const userId = token ? verifyUserSessionToken(token) : null;

  if (!userId) {
    redirect("/auth/login");
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      team: true,
      claims: {
        include: {
          location: true,
          team: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
    },
  });

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <main className="terrain-grid min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex justify-end">
          <Link href="/" className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Back to map
          </Link>
        </div>

        <section className="glass-panel rounded-[30px] border border-[var(--line)] p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Player profile</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em]">{user.handle}</h1>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Team: <span className="font-medium" style={{ color: user.team.colorHex }}>{user.team.name}</span>
              </p>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
              >
                Sign out
              </button>
            </form>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[20px] border border-[var(--line)] bg-white/70 p-4">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Player power</div>
              <div className="mt-2 text-2xl font-semibold">💪 {user.power}</div>
            </div>
            <div className="rounded-[20px] border border-[var(--line)] bg-white/70 p-4">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Team power</div>
              <div className="mt-2 text-2xl font-semibold">💪 {user.team.power}</div>
            </div>
            <div className="rounded-[20px] border border-[var(--line)] bg-white/70 p-4">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Total claims</div>
              <div className="mt-2 text-2xl font-semibold">{user.claims.length}</div>
            </div>
          </div>

          <div className="mt-3 rounded-[20px] border border-[var(--line)] bg-white/70 p-4 text-sm">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Profile details</p>
            <p className="mt-2">
              {user.firstName ?? "-"} {user.lastName ?? "-"} · {user.email ?? "-"} · age {user.age ?? "-"}
            </p>
          </div>
        </section>

        <section className="glass-panel rounded-[30px] border border-[var(--line)] p-6 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">Your recent claims</h2>
          </div>
          <div className="mt-4 space-y-3">
            {user.claims.length ? user.claims.map((claim) => (
              <div key={claim.id} className="rounded-[20px] border border-[var(--line)] bg-white/70 p-4">
                <p className="text-sm leading-6">
                  Claimed <span className="font-medium">{claim.location.name}</span> for <span className="font-medium">{claim.team.name}</span> on {formatDate(claim.createdAt.toISOString())}.
                </p>
                {claim.message ? (
                  <p className="mt-2 rounded-xl bg-[rgba(213,108,50,0.08)] px-3 py-2 text-sm text-[var(--accent-strong)]">
                    “{claim.message}”
                  </p>
                ) : null}
              </div>
            )) : (
              <p className="rounded-[20px] border border-dashed border-[var(--line)] bg-white/55 p-4 text-sm text-[var(--muted)]">
                No claims yet. Scan a QR and claim your first location.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
