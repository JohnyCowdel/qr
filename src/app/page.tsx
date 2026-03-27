import Link from "next/link";

import { TerritoryMap } from "@/components/territory-map";
import { getHomePageData } from "@/lib/game";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export default async function Home() {
  const { locations, recentClaims, teamSummary } = await getHomePageData();

  return (
    <main className="terrain-grid min-h-screen px-4 py-6 text-foreground sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <section className="glass-panel overflow-hidden rounded-[32px] border border-[var(--line)] p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6">
              <div className="inline-flex items-center rounded-full border border-[var(--line)] bg-[var(--panel-strong)] px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                GPS verified territory control
              </div>
              <div className="space-y-4">
                <h1 className="max-w-2xl text-4xl font-semibold tracking-[-0.04em] sm:text-6xl">
                  Scan the QR, stand on the ground, and take the point.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                  Every location has its own landing page, team ownership, claim
                  history, and QR code. This prototype uses a real database and
                  verifies each claim against the location GPS coordinates.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[24px] border border-[var(--line)] bg-[var(--panel-strong)] p-4">
                  <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Active locations
                  </div>
                  <div className="mt-3 text-4xl font-semibold">{locations.length}</div>
                </div>
                <div className="rounded-[24px] border border-[var(--line)] bg-[var(--panel-strong)] p-4">
                  <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Claims logged
                  </div>
                  <div className="mt-3 text-4xl font-semibold">{recentClaims.length}</div>
                </div>
                <div className="rounded-[24px] border border-[var(--line)] bg-[var(--panel-strong)] p-4">
                  <div className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                    Teams deployed
                  </div>
                  <div className="mt-3 text-4xl font-semibold">{teamSummary.length}</div>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4 rounded-[28px] border border-[var(--line)] bg-[linear-gradient(180deg,rgba(255,252,245,0.95),rgba(234,225,208,0.85))] p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-[-0.03em]">
                  Frontline status
                </h2>
                <span className="rounded-full bg-[rgba(213,108,50,0.12)] px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] text-[var(--accent-strong)]">
                  Live state
                </span>
              </div>
              <div className="space-y-3">
                {teamSummary.map((team) => (
                  <div
                    key={team.slug}
                    className="flex items-center justify-between rounded-[20px] border border-[var(--line)] bg-white/70 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-3.5 w-3.5 rounded-full"
                        style={{ backgroundColor: team.colorHex }}
                      />
                      <span className="font-medium">{team.name}</span>
                    </div>
                    <span className="font-mono text-sm text-[var(--muted)]">
                      {team.claimedCount} claimed
                    </span>
                  </div>
                ))}
              </div>
              <div className="rounded-[24px] border border-dashed border-[var(--line)] bg-[rgba(255,255,255,0.42)] p-4 text-sm leading-6 text-[var(--muted)]">
                Scan one of the generated QR codes to open a specific location page,
                then share GPS to confirm you are within the allowed claim radius.
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="glass-panel rounded-[32px] border border-[var(--line)] p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-4 px-2">
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.03em]">
                  Claimed terrain map
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Colored circles visualize each location&apos;s current claim radius.
                </p>
              </div>
              <Link
                href={locations[0] ? `/l/${locations[0].slug}` : "/"}
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--accent-strong)]"
              >
                Open a sample point
              </Link>
            </div>
            <div className="h-[460px] overflow-hidden rounded-[28px] border border-[var(--line)]">
              <TerritoryMap locations={locations} />
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <section className="glass-panel rounded-[32px] border border-[var(--line)] p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-semibold tracking-[-0.03em]">
                  Recent claims
                </h2>
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  Event feed
                </span>
              </div>
              <div className="mt-4 space-y-3">
                {recentClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="rounded-[24px] border border-[var(--line)] bg-white/70 p-4"
                  >
                    <p className="text-sm leading-6">
                      <span className="font-medium">{claim.user.handle}</span>{" "}
                      claimed <span className="font-medium">{claim.location.name}</span>{" "}
                      for <span className="font-medium">{claim.team.name}</span> on{" "}
                      {formatDate(claim.createdAt)}.
                    </p>
                    {claim.message ? (
                      <p className="mt-2 rounded-2xl bg-[rgba(213,108,50,0.08)] px-3 py-2 text-sm leading-6 text-[var(--accent-strong)]">
                        “{claim.message}”
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="glass-panel rounded-[32px] border border-[var(--line)] p-5">
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">
                Location roster
              </h2>
              <div className="mt-4 space-y-3">
                {locations.map((location) => (
                  <Link
                    key={location.id}
                    href={`/l/${location.slug}`}
                    className="block rounded-[24px] border border-[var(--line)] bg-white/70 p-4 transition hover:-translate-y-0.5 hover:bg-white"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="font-medium">{location.name}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          {location.summary}
                        </p>
                      </div>
                      <div className="text-right font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                        {location.ownerTeam ? location.ownerTeam.name : "Neutral"}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
