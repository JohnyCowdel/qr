import Link from "next/link";
import { cookies } from "next/headers";
import { AutoRefresh } from "@/components/auto-refresh";
import { TerritoryMap } from "@/components/territory-map";
import { ClaimEventCard } from "@/components/claim-event-card";
import { LeaderboardPanel } from "@/components/leaderboard-panel";
import { USER_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { getHomePageData } from "@/lib/game";

function formatPower(power: number) {
  return power.toFixed(2);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export default async function Home() {
  const { locations, recentClaims, teamSummary, totalTeamPower, totalPlayerPower } = await getHomePageData();

  const cookieStore = await cookies();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;
  const userId = token ? verifyUserSessionToken(token) : null;
  const currentUser = userId
    ? await db.user.findUnique({
        where: { id: userId },
        include: { team: true },
      })
    : null;

  return (
    <main className="terrain-grid min-h-screen px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <AutoRefresh intervalMs={5000} />
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        {currentUser ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
              >
                Odhlásit se
              </button>
            </form>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                href="/jak-na-to"
                className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
              >
                Jak na to? 📖
              </Link>
              <Link
                href="/me"
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
              >
                 {currentUser.handle} · 💪 {formatPower(currentUser.power)} · {currentUser.team.name}
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                href="/auth/login"
                className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
              >
                Přihlásit se
              </Link>
              <Link
                href="/jak-na-to"
                className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
              >
                Jak na to? 📖
              </Link>
            </div>
            <Link
              href="/auth/register"
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
            >
              Vytvořit účet
            </Link>
          </div>
        )}

        <section className="glass-panel overflow-hidden rounded-[32px] border border-[var(--line)] p-5 sm:p-6">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="space-y-3">
                <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                  Prozkoumej, naskenuj, obsazuj !
                </h1>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-[22px] border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                    Aktivní lokace
                  </div>
                  <div className="mt-2 text-3xl font-semibold">{locations.length}</div>
                </div>
                <div className="rounded-[22px] border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                    Obsazené lokace
                  </div>
                  <div className="mt-2 text-3xl font-semibold">{locations.filter((l) => l.ownerTeam !== null).length}</div>
                </div>
                <div className="rounded-[22px] border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                    Síla hráčů
                  </div>
                  <div className="mt-2 text-3xl font-semibold">💪 {formatPower(totalPlayerPower)}</div>
                </div>
              </div>
            </div>
            
          </div>
        </section>

        <section className="glass-panel rounded-[32px] border border-[var(--line)] p-4 sm:p-5">
          
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-[-0.03em]">
                  Výsledková tabulka
                </h2>
                <span className="rounded-full bg-[rgba(213,108,50,0.12)] px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                  Live data
                </span>
              </div>
              <LeaderboardPanel teams={teamSummary} />
            
        </section>

        <section className="glass-panel rounded-[32px] border border-[var(--line)] p-4 sm:p-5">
          <div className="mb-4 px-2">
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">
              Mapa obsazeného územní
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Klikni na bod pro více informací.
            </p>
          </div>
          <div className="aspect-square w-full overflow-hidden rounded-[28px] border border-[var(--line)]">
            <TerritoryMap locations={locations} />
          </div>
        </section>

        <section className="glass-panel rounded-[32px] border border-[var(--line)] p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">
              Poslední zábory
            </h2>
            <span className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              Aktivity
            </span>
          </div>
          <div className="mt-4 space-y-3">
            {recentClaims.map((claim) => (
              <ClaimEventCard
                key={claim.id}
                user={claim.user}
                message={claim.message}
                summary={(
                  <>
                    obsadil <span className="font-medium">{claim.location.name}</span>{" "}
                    pro <span className="font-medium">{claim.team.name}</span> dne {formatDate(claim.createdAt)}.
                  </>
                )}
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
