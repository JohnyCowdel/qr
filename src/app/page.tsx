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

        <section className="glass-panel overflow-hidden rounded-[32px] border border-[var(--line)] p-5 sm:p-6">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-4">
              <div className="space-y-3">
                <h1 className="max-w-2xl text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
                  Naskenuj QR kód, prozkoumej lokaci, a získej ji pro svůj tým.
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
                    Získaná území
                  </div>
                  <div className="mt-2 text-3xl font-semibold">{recentClaims.length}</div>
                </div>
                <div className="rounded-[22px] border border-[var(--line)] bg-[var(--panel-strong)] p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
                    Týmy v akci
                  </div>
                  <div className="mt-2 text-3xl font-semibold">{teamSummary.length}</div>
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
            
        </section>

        <section className="glass-panel rounded-[32px] border border-[var(--line)] p-4 sm:p-5">
          <div className="mb-4 px-2">
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">
              Claimed terrain map
            </h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Colored circles visualize each location&apos;s current claim radius.
            </p>
          </div>
          <div className="aspect-square w-full overflow-hidden rounded-[28px] border border-[var(--line)]">
            <TerritoryMap locations={locations} />
          </div>
        </section>

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
      </div>
    </main>
  );
}
