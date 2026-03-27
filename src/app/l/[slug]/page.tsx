import Image from "next/image";
import { notFound } from "next/navigation";

import { ClaimPanel } from "@/components/claim-panel";
import { TerritoryMap } from "@/components/territory-map";
import { formatMeters } from "@/lib/geo";
import { getLocationPageData } from "@/lib/game";

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

export default async function LocationPage(props: PageProps<"/l/[slug]">) {
  const { slug } = await props.params;
  const data = await getLocationPageData(slug);

  if (!data) {
    notFound();
  }

  const { location, teams } = data;

  return (
    <main className="terrain-grid min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <section className="glass-panel rounded-[32px] border border-[var(--line)] p-6 sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                  QR code {location.qrCode}
                </span>
                <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 text-sm">
                  {location.ownerTeam ? `${location.ownerTeam.name} controls this point` : "Neutral point"}
                </span>
              </div>

              <div>
                <h1 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
                  {location.name}
                </h1>
                <p className="mt-3 max-w-2xl text-lg leading-8 text-[var(--muted)]">
                  {location.summary}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-[var(--line)] bg-white/70 p-4">
                  <div className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    Claim radius
                  </div>
                  <div className="mt-2 text-3xl font-semibold">
                    {formatMeters(location.claimRadiusM)}
                  </div>
                </div>
                <div className="rounded-[22px] border border-[var(--line)] bg-white/70 p-4">
                  <div className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    Last capture
                  </div>
                  <div className="mt-2 text-base font-medium">
                    {location.lastClaimedAt ? formatDate(location.lastClaimedAt) : "Not claimed yet"}
                  </div>
                </div>
                <div className="rounded-[22px] border border-[var(--line)] bg-white/70 p-4">
                  <div className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    Neighbors
                  </div>
                  <div className="mt-2 text-base font-medium">
                    {location.neighbors ?? "No adjacent points yet"}
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-[var(--line)] bg-[rgba(255,255,255,0.68)] p-5 text-base leading-8 text-[var(--muted)]">
                {location.content}
              </div>
            </div>

            <div className="space-y-4">
              <div className="overflow-hidden rounded-[28px] border border-[var(--line)] bg-white/75 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold tracking-[-0.03em]">Printable QR</h2>
                  <span className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    Scan to open
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-center rounded-[24px] bg-white p-4">
                  <Image
                    src={`/qr/${location.slug}`}
                    alt={`QR code for ${location.name}`}
                    width={224}
                    height={224}
                    unoptimized
                    className="h-56 w-56"
                  />
                </div>
              </div>

              <div className="h-[260px] overflow-hidden rounded-[28px] border border-[var(--line)]">
                <TerritoryMap
                  locations={[
                    {
                      id: location.id,
                      slug: location.slug,
                      name: location.name,
                      summary: location.summary,
                      latitude: location.latitude,
                      longitude: location.longitude,
                      claimRadiusM: location.claimRadiusM,
                      ownerTeam: location.ownerTeam,
                    },
                  ]}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <ClaimPanel
            location={{
              id: location.id,
              slug: location.slug,
              latitude: location.latitude,
              longitude: location.longitude,
              claimRadiusM: location.claimRadiusM,
            }}
            teams={teams}
          />

          <section className="glass-panel rounded-[28px] border border-[var(--line)] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-[-0.03em]">Claim history</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Every successful claim and message is stored as an immutable event.
                </p>
              </div>
              <div className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                {location.claims.length} entries
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {location.claims.length ? (
                location.claims.map((claim) => (
                  <div
                    key={claim.id}
                    className="rounded-[24px] border border-[var(--line)] bg-white/70 p-4"
                  >
                    <p className="text-sm leading-6">
                      <span className="font-medium">{claim.user.handle}</span>{" "}
                      claimed this position for <span className="font-medium">{claim.team.name}</span>{" "}
                      on {formatDate(claim.createdAt)} at {formatMeters(claim.distanceM)}.
                    </p>
                    {claim.message ? (
                      <p className="mt-2 rounded-2xl bg-[rgba(47,125,93,0.08)] px-3 py-2 text-sm leading-6 text-[#255943]">
                        “{claim.message}”
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--line)] bg-white/55 p-4 text-sm text-[var(--muted)]">
                  No one has claimed this point yet.
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}