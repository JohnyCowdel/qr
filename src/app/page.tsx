import Link from "next/link";
import { cookies } from "next/headers";
import { AutoRefresh } from "@/components/auto-refresh";
import { TerritoryMap } from "@/components/territory-map";
import { ClaimEventCard } from "@/components/claim-event-card";
import { LeaderboardPanel } from "@/components/leaderboard-panel";
import { USER_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { after } from "next/server";
import { getHomePageData } from "@/lib/game";
import { runEconomyTick } from "@/lib/economy";
import { DailyRewardButton } from "@/components/daily-reward-button";

export const dynamic = "force-dynamic";

function formatPower(power: number) {
  return power.toFixed(2);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("cs", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Prague",
  }).format(new Date(date));
}

export default async function Home() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;
  const userId = token ? verifyUserSessionToken(token) : null;
  after(() => runEconomyTick());
  const { locations, recentClaims, teamSummary, totalTeamPower, totalPlayerPower } = await getHomePageData();

  const [currentUser, adminSettings] = await Promise.all([
    userId
      ? db.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            handle: true,
            power: true,
            lastDailyClaimAt: true,
            team: { select: { id: true, name: true, emoji: true, colorHex: true } },
          },
        })
      : Promise.resolve(null),
    db.adminSettings.findUnique({ where: { id: 1 }, select: { dailyLoginReward: true, registrationsOpen: true } }),
  ]);
  const dailyReward = adminSettings?.dailyLoginReward ?? 8;
  const registrationsOpen = adminSettings?.registrationsOpen ?? true;

  return (
    <main className="terrain-grid min-h-screen px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <AutoRefresh intervalMs={300_000} />
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
              <DailyRewardButton
                lastDailyClaimAt={currentUser.lastDailyClaimAt ? String(currentUser.lastDailyClaimAt) : null}
                power={currentUser.power}
                dailyReward={dailyReward}
              />
              <Link
                href="/jak-na-to"
                className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
              >
                Jak na to? 📖
              </Link>
              <Link
                href="/me"
                className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: currentUser.team.colorHex }}
              >
                  {currentUser.handle} · 💪 {formatPower(currentUser.power)} · {currentUser.team.emoji}
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
            {registrationsOpen ? (
              <Link
                href="/auth/register"
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
              >
                Vytvořit účet
              </Link>
            ) : (
              <span
                className="cursor-not-allowed rounded-full border border-[var(--line)] bg-white/50 px-4 py-2 text-sm font-semibold text-[var(--muted)]"
                title="Registrace jsou momentálně uzavřené"
              >
                Registrace uzavřeny
              </span>
            )}
          </div>
        )}

        <section className="glass-panel overflow-hidden rounded-[32px] border border-[var(--line)] p-5 sm:p-6">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="space-y-3">
                <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                  QREMPIRE - Prozkoumej, naskenuj, obsazuj !
                </h1>
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
            <TerritoryMap locations={locations} enableFullscreen />
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
          <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {recentClaims.map((claim) => (
              <ClaimEventCard
                key={claim.id}
                user={claim.user}
                message={claim.message}
                summary={(
                  <>
                    obsadil <span className="font-medium">{claim.location.name}</span>{" "}
                    pro <span className="font-medium">{claim.team.emoji} {claim.team.name}</span> dne {formatDate(claim.createdAt)}.
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
