import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { ClaimPanel } from "@/components/claim-panel";
import { ClaimEventCard } from "@/components/claim-event-card";
import { AutoRefresh } from "@/components/auto-refresh";
import { BuildingsPanel } from "@/components/buildings-panel";
import { LocationEconomyControls } from "@/components/location-economy-controls";
import { USER_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { TerritoryMap } from "@/components/territory-map";
import { formatMeters } from "@/lib/geo";
import { getLocationPageData } from "@/lib/game";
import { czechNameForType, normalizeLocationType } from "@/lib/location-types";

function formatPopulation(population: number) {
  return new Intl.NumberFormat("cs").format(Math.floor(population));
}

function formatPower(power: number) {
  return power.toFixed(2);
}

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

  const { location, mapLocations } = data;

  const cookieStore = await cookies();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;
  const userId = token ? verifyUserSessionToken(token) : null;

  const [currentUser, builtArmorRows] = await Promise.all([
    userId
      ? db.user.findUnique({
          where: { id: userId },
          select: {
            id: true, handle: true, power: true,
            team: { select: { id: true, name: true, emoji: true, colorHex: true } },
          },
        })
      : Promise.resolve(null),
    db.builtBuilding.findMany({
      where: { locationId: location.id },
      select: {
        buildingDef: { select: { effectArm: true } },
      },
    }),
  ]);

  const armorBonus = builtArmorRows.reduce((sum, row) => sum + row.buildingDef.effectArm, 0);
  const effectiveArmor = location.armor + Math.floor(armorBonus);
  const locationEconomy = location as typeof location & {
    popToMoney?: number;
    popToPower?: number;
    popToPopulation?: number;
  };
  const canManageEconomy = Boolean(currentUser && location.ownerUser && currentUser.id === location.ownerUser.id);

  return (
    <main className="terrain-grid min-h-screen px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <AutoRefresh intervalMs={60_000} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-6">
        {currentUser ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
              >
                Zpět na mapu
              </Link>
              <form action="/api/auth/logout" method="post">
                <button
                  type="submit"
                  className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
                >
                  Odhlásit se
                </button>
              </form>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link
                href="/me"
                className="rounded-full px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: currentUser.team.colorHex }}
              >
                {currentUser.team.emoji} {currentUser.handle} · 💪 {formatPower(currentUser.power)}
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
              >
                Zpět na mapu
              </Link>
              <Link
                href="/auth/login"
                className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
              >
                Přihlásit se
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

        <section className="glass-panel rounded-[28px] border border-[var(--line)] p-4 sm:rounded-[32px] sm:p-8">
          <div className="grid gap-5 sm:gap-8 lg:grid-cols-[1fr_0.9fr]">
            <div className="space-y-4 sm:space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 text-sm">
                  {location.ownerTeam ? `${location.ownerTeam.emoji} ${location.ownerTeam.name} ovládá tento bod` : "Neutrální bod"}
                </span>
              </div>

              <div>
                <h1 className="text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
                  {location.name}
                </h1>
                <p className="mt-2 max-w-2xl text-base leading-7 text-[var(--muted)] sm:mt-3 sm:text-lg sm:leading-8">
                  {location.summary}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                
                <div className="rounded-[18px] border border-[var(--line)] bg-white/70 p-3 sm:rounded-[22px] sm:p-4">
                  <div className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    Typ lokace
                  </div>
                  <div className="mt-2 text-base font-medium">
                    {location.image} {czechNameForType(normalizeLocationType(location.type))}
                  </div>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-white/70 p-3 sm:rounded-[22px] sm:p-4">
                  <div className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    👨‍🌾 Populace
                  </div>
                  <div className={`mt-2 text-base font-medium${Math.floor(location.currentPopulation) >= location.maxPopulation ? " text-red-600" : ""}`}>
                    {formatPopulation(location.currentPopulation)}
                  </div>
                  {Math.floor(location.currentPopulation) >= location.maxPopulation && (
                    <p className="mt-1 text-xs italic text-red-500">Populace na maximu</p>
                  )}
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-white/70 p-3 sm:rounded-[22px] sm:p-4">
                  <div className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    🛡️ Obrana
                  </div>
                  <div className="mt-2 text-base font-medium">
                    {effectiveArmor}
                  </div>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-white/70 p-3 sm:rounded-[22px] sm:p-4">
                  <div className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    👑 Vlastní
                  </div>
                  <div className="mt-2 text-base font-medium">
                    {location.ownerTeam ? `${location.ownerTeam.emoji} ${location.ownerTeam.name}` : "Neutrální"}
                  </div>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
                <div className="rounded-[18px] border border-[var(--line)] bg-white/70 p-3 sm:rounded-[22px] sm:p-4">
                  <div className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    Poslední zábor
                  </div>
                  <div className="mt-2 text-base font-medium">
                    {location.lastClaimedAt ? formatDate(location.lastClaimedAt) : "Ještě nezabráno"}
                  </div>
                </div>
                <div className="rounded-[18px] border border-[var(--line)] bg-white/70 p-3 sm:rounded-[22px] sm:p-4">
                  <div className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    Hráč-vlastník
                  </div>
                  <div className="mt-2 text-base font-medium">
                    {location.ownerUser ? `@${location.ownerUser.handle}` : "Zatím žádný vlastník"}
                  </div>
                </div>
              </div>

              <div className="rounded-[20px] border border-[var(--line)] bg-[rgba(255,255,255,0.68)] p-4 text-sm leading-7 text-[var(--muted)] sm:rounded-[24px] sm:p-5 sm:text-base sm:leading-8">
                {location.content}
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div className="h-[220px] overflow-hidden rounded-[22px] border border-[var(--line)] sm:h-[260px] sm:rounded-[28px]">
                <TerritoryMap
                  locations={mapLocations}
                  center={[location.latitude, location.longitude]}
                  initialZoom={16}
                  autoFitBounds={false}
                />
              </div>
            </div>
          </div>
        </section>

        {canManageEconomy ? (
          <LocationEconomyControls
            slug={location.slug}
            currentPopulation={location.currentPopulation}
            maxPopulation={location.maxPopulation}
            popToMoney={locationEconomy.popToMoney ?? 0}
            popToPower={locationEconomy.popToPower ?? 0}
            popToPopulation={locationEconomy.popToPopulation ?? 30}
          />
        ) : null}

        <BuildingsPanel slug={location.slug} canManage={canManageEconomy} locationType={location.type} />

        <section className="grid gap-4 sm:gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="space-y-4 sm:space-y-6">
            <ClaimPanel
              location={{
                id: location.id,
                slug: location.slug,
                latitude: location.latitude,
                longitude: location.longitude,
                claimRadiusM: location.claimRadiusM,
                armor: effectiveArmor,
              }}
              isOwner={canManageEconomy}
            />
          </div>

          <section className="glass-panel rounded-[24px] border border-[var(--line)] p-4 sm:rounded-[28px] sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-[-0.03em] sm:text-2xl">Historie záborů</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Každý úspěšný zábor a zpráva je uložena jako neměnná událost.
                </p>
              </div>
              <div className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                {location.claims.length} záznamů
              </div>
            </div>

            <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1 sm:mt-4 sm:max-h-[520px] sm:space-y-3">
              {location.claims.length ? (
                location.claims.map((claim) => (
                  <ClaimEventCard
                    key={claim.id}
                    user={claim.user}
                    message={claim.message}
                    messageClassName="bg-[rgba(47,125,93,0.08)] text-[#255943]"
                    summary={(
                      <>
                        zabrán pro <span className="font-medium">{claim.team.emoji} {claim.team.name}</span>{" "}
                        dne {formatDate(claim.createdAt)} ve vzdálenosti {formatMeters(claim.distanceM)}.
                      </>
                    )}
                  />
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-[var(--line)] bg-white/55 p-4 text-sm text-[var(--muted)]">
                  Tento bod ještě nikdo nenabral.
                </div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}