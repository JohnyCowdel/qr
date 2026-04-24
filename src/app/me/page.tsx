import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { USER_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth";
import { AutoRefresh } from "@/components/auto-refresh";
import { ClaimEventCard } from "@/components/claim-event-card";
import { PlayerAvatarEditor } from "@/components/player-avatar-editor";
import { TradeOffersPanel } from "@/components/trade-offers-panel";
import { resolveAvatarSrc } from "@/lib/avatar-sprites";
import { db } from "@/lib/db";
import { getEconomyRates, normalizeWorkerSplit, runEconomyTick } from "@/lib/economy";

export const dynamic = "force-dynamic";

function formatPower(power: number) {
  return power.toFixed(2);
}

function formatMoney(money: number) {
  return `$${money.toFixed(2)}`;
}

function formatGrowth(value: number) {
  return `+${value.toFixed(2)}/den`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function formatPlayerName(player: {
  firstName: string | null;
  lastName: string | null;
  handle: string;
}) {
  const fullName = [player.firstName, player.lastName].filter(Boolean).join(" ").trim();
  return fullName || player.handle;
}

export default async function MePage() {
  await runEconomyTick();

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

  const [teamPlayers, otherPlayers, offerTargets, pendingOffers, economyRates, activeOwnedLocations] = await Promise.all([
    db.user.findMany({
      where: {
        teamId: user.teamId,
        isApproved: true,
        passwordHash: { not: null },
      },
      orderBy: [
        { power: "desc" },
        { handle: "asc" },
      ],
      select: {
        id: true,
        handle: true,
        firstName: true,
        lastName: true,
        power: true,
        money: true,
        avatarType: true,
        avatarSprite: true,
        avatarSeed: true,
        avatarPhotoDataUrl: true,
      },
    }),
    db.user.findMany({
      where: {
        id: { not: user.id },
        teamId: { not: user.teamId },
        isApproved: true,
        passwordHash: { not: null },
      },
      include: {
        team: {
          select: {
            name: true,
            colorHex: true,
            emoji: true,
          },
        },
      },
      orderBy: [
        { teamId: "asc" },
        { power: "desc" },
        { handle: "asc" },
      ],
    }),
    db.user.findMany({
      where: {
        id: { not: user.id },
        isApproved: true,
        passwordHash: { not: null },
      },
      include: {
        team: {
          select: {
            name: true,
            colorHex: true,
            emoji: true,
          },
        },
      },
      orderBy: [
        { teamId: "asc" },
        { handle: "asc" },
      ],
    }),
    db.tradeOffer.findMany({
      where: {
        status: "PENDING",
        OR: [
          { fromUserId: user.id },
          { toUserId: user.id },
        ],
      },
      include: {
        fromUser: {
          select: {
            handle: true,
          },
        },
        toUser: {
          select: {
            handle: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    }),
    getEconomyRates(),
    db.location.findMany({
      where: {
        ownerTeamId: { not: null },
      },
      orderBy: {
        lastClaimedAt: "desc",
      },
      select: {
        id: true,
        slug: true,
        name: true,
        image: true,
        currentPopulation: true,
        popToMoney: true,
        popToPower: true,
        popToPopulation: true,
        workersAutoStoppedAt: true,
        ownerTeam: {
          select: {
            name: true,
            colorHex: true,
            emoji: true,
          },
        },
        claims: {
          select: {
            userId: true,
            createdAt: true,
            team: {
              select: {
                name: true,
                colorHex: true,
                emoji: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
      },
    }),
  ]);

  const incomingOffers = pendingOffers
    .filter((offer) => offer.toUserId === user.id)
    .map((offer) => ({
      id: offer.id,
      fromUserId: offer.fromUserId,
      toUserId: offer.toUserId,
      offerType: offer.offerType,
      offerAmount: offer.offerAmount,
      requestType: offer.requestType,
      requestAmount: offer.requestAmount,
      createdAt: offer.createdAt.toISOString(),
      fromUserHandle: offer.fromUser.handle,
      toUserHandle: offer.toUser.handle,
    }));

  const outgoingOffers = pendingOffers
    .filter((offer) => offer.fromUserId === user.id)
    .map((offer) => ({
      id: offer.id,
      fromUserId: offer.fromUserId,
      toUserId: offer.toUserId,
      offerType: offer.offerType,
      offerAmount: offer.offerAmount,
      requestType: offer.requestType,
      requestAmount: offer.requestAmount,
      createdAt: offer.createdAt.toISOString(),
      fromUserHandle: offer.fromUser.handle,
      toUserHandle: offer.toUser.handle,
    }));

  const currentAvatarSrc = resolveAvatarSrc(user);
  const activeLocationsForUser = activeOwnedLocations.filter((location) => location.claims[0]?.userId === user.id);

  const activeLocationIds = activeLocationsForUser.map((location) => location.id);
  const builtEffects = activeLocationIds.length
    ? await db.builtBuilding.findMany({
        where: {
          locationId: { in: activeLocationIds },
        },
        select: {
          locationId: true,
          buildingDef: {
            select: {
              effectMny: true,
              effectPow: true,
            },
          },
        },
      })
    : [];

  const effectsByLocation = new Map<number, { mny: number; pow: number }>();
  for (const row of builtEffects) {
    const current = effectsByLocation.get(row.locationId) ?? { mny: 0, pow: 0 };
    current.mny += row.buildingDef.effectMny;
    current.pow += row.buildingDef.effectPow;
    effectsByLocation.set(row.locationId, current);
  }

  const growthPerDay = activeLocationsForUser.reduce(
    (acc, location) => {
      const workers = normalizeWorkerSplit(location.currentPopulation, {
        money: location.popToMoney,
        power: location.popToPower,
        population: location.popToPopulation,
      });
      const locationEffects = effectsByLocation.get(location.id) ?? { mny: 0, pow: 0 };
      const effectiveMoneyRate = economyRates.moneyRate + locationEffects.mny;
      const effectivePowerRate = economyRates.powerRate + locationEffects.pow;

      return {
        money: acc.money + workers.money * effectiveMoneyRate,
        power: acc.power + workers.power * effectivePowerRate,
      };
    },
    { money: 0, power: 0 },
  );
  const myClaimedPositions = activeLocationsForUser.map((location) => ({
    id: location.id,
    slug: location.slug,
    name: location.name,
    image: location.image,
    ownerTeam: location.ownerTeam,
    claimedAt: location.claims[0].createdAt,
    claimedForTeam: location.claims[0].team,
    noWorkers: (location.popToMoney + location.popToPower + location.popToPopulation) === 0,
    workersAutoStoppedAt: location.workersAutoStoppedAt,
  }));

  return (
    <main className="terrain-grid min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <AutoRefresh intervalMs={5000} />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link href="/" className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
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

        <section className="glass-panel rounded-[30px] border border-[var(--line)] p-6 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <PlayerAvatarEditor
                currentAvatarType={user.avatarType}
                currentAvatarSprite={user.avatarSprite}
                currentAvatarSeed={user.avatarSeed}
                currentAvatarSrc={currentAvatarSrc}
                currentHandle={user.handle}
              />
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Profil hráče</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em]">{user.handle}</h1>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Tým: <span className="font-medium" style={{ color: user.team.colorHex }}>{user.team.emoji} {user.team.name}</span>
                </p>
              </div>
            </div>
            <form action="/api/auth/logout" method="post">
              <button
                type="submit"
                className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
              >
                Odhlásit se
              </button>
            </form>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-[20px] border border-[var(--line)] bg-white/70 p-4">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Síla hráče</div>
              <div className="mt-2 text-2xl font-semibold">💪 {formatPower(user.power)}</div>
              <div className="mt-1 text-sm font-medium text-emerald-700">↗ {formatGrowth(growthPerDay.power)}</div>
            </div>
            <div className="rounded-[20px] border border-[var(--line)] bg-white/70 p-4">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Peníze</div>
              <div className="mt-2 text-2xl font-semibold">💰 {formatMoney(user.money)}</div>
              <div className="mt-1 text-sm font-medium text-emerald-700">↗ {formatGrowth(growthPerDay.money)}</div>
            </div>
            <div className="rounded-[20px] border border-[var(--line)] bg-white/70 p-4">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Celkem záborů</div>
              <div className="mt-2 text-2xl font-semibold">{user.claims.length}</div>
            </div>
          </div>

          <div className="mt-3 rounded-[20px] border border-[var(--line)] bg-white/70 p-4 text-sm">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Detaily profilu</p>
            <p className="mt-2">
              {user.firstName ?? "-"} {user.lastName ?? "-"} · {user.email ?? "-"} · age {user.age ?? "-"}
            </p>
          </div>
        </section>

        <TradeOffersPanel
          currentUserId={user.id}
          targets={offerTargets.map((target) => ({
            id: target.id,
            handle: target.handle,
            teamName: `${target.team.emoji} ${target.team.name}`,
            teamColorHex: target.team.colorHex,
          }))}
          incomingOffers={incomingOffers}
          outgoingOffers={outgoingOffers}
        />

        <section className="glass-panel rounded-[30px] border border-[var(--line)] p-6 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">Tvoje pozice</h2>
            <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              {myClaimedPositions.length} obsazeno
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {myClaimedPositions.length ? myClaimedPositions.map((position) => (
              <div
                key={position.id}
                className={`rounded-[20px] border p-4 ${position.noWorkers ? "border-amber-300 bg-amber-50" : "border-[var(--line)] bg-white/70"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{position.image} {position.name}</p>
                    {position.noWorkers ? (
                      <p className="mt-1 text-sm font-semibold text-amber-800">Nikdo tu nepracuje!</p>
                    ) : null}
                    <p className="text-sm text-[var(--muted)]">
                      Obsazeno pro tým: <span style={{ color: position.claimedForTeam.colorHex }}>{position.claimedForTeam.emoji} {position.claimedForTeam.name}</span>
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      {position.ownerTeam ? (
                        <>
                          Aktuální vlastník: <span style={{ color: position.ownerTeam.colorHex }}>{position.ownerTeam.emoji} {position.ownerTeam.name}</span>
                        </>
                      ) : (
                        "Aktuální vlastník: Neutrální"
                      )}
                    </p>
                  </div>
                  <div className="text-right text-xs text-[var(--muted)]">
                    <p className="font-mono uppercase tracking-[0.12em]">Obsazeno dne</p>
                    <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
                      {formatDate(position.claimedAt.toISOString())}
                    </p>
                  </div>
                </div>
                <div className="mt-3">
                  <Link
                    href={`/l/${position.slug}`}
                    className="inline-flex rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-[var(--background-strong)]"
                  >
                    Open location
                  </Link>
                </div>
              </div>
            )) : (
              <p className="rounded-[20px] border border-dashed border-[var(--line)] bg-white/55 p-4 text-sm text-[var(--muted)]">
                Zatím jsi neobsadil/a žádnou pozici.
              </p>
            )}
          </div>
        </section>

        <section className="glass-panel rounded-[30px] border border-[var(--line)] p-6 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">Nedávné zábory</h2>
          </div>
          <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
            {user.claims.length ? user.claims.map((claim) => (
              <ClaimEventCard
                key={claim.id}
                user={user}
                message={claim.message}
                actionHref={`/l/${claim.location.slug}`}
                summary={(
                  <>
                    obsadil/a <span className="font-medium">{claim.location.name}</span> pro <span className="font-medium">{claim.team.emoji} {claim.team.name}</span> dne {formatDate(claim.createdAt.toISOString())}.
                  </>
                )}
              />
            )) : (
              <p className="rounded-[20px] border border-dashed border-[var(--line)] bg-white/55 p-4 text-sm text-[var(--muted)]">
                Zatím jsi neobsadil/a žádnou pozici. Naskenuj QR kód a obsad svou první lokaci.
              </p>
            )}
          </div>
        </section>

        <section className="glass-panel rounded-[30px] border border-[var(--line)] p-6 sm:p-7">
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">Týmy</h2>
          <div className="mt-4 space-y-3">
            <details className="rounded-[20px] border border-[var(--line)] bg-white/70 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                <span>Váš tým</span>
                <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                  {teamPlayers.length} hráčů
                </span>
              </summary>
              <div className="mt-4 space-y-3">
                {teamPlayers.length ? teamPlayers.map((player) => (
                  <div key={player.id} className="rounded-[20px] border border-[var(--line)] bg-white/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={resolveAvatarSrc(player)}
                          alt={formatPlayerName(player)}
                          className="h-12 w-12 rounded-[14px] border border-[var(--line)] bg-white object-cover"
                        />
                        <div>
                          <p className="font-medium">{formatPlayerName(player)}</p>
                          <p className="text-sm text-[var(--muted)]">@{player.handle}{player.id === user.id ? " · ty" : ""}</p>
                        </div>
                      </div>
                      <div className="text-sm font-semibold">💪 {formatPower(player.power)}</div>
                    </div>
                  </div>
                )) : (
                  <p className="rounded-[20px] border border-dashed border-[var(--line)] bg-white/55 p-4 text-sm text-[var(--muted)]">
                    Žádní schválení spoluhráči nebyli nalezeni.
                  </p>
                )}
              </div>
            </details>

            <details className="rounded-[20px] border border-[var(--line)] bg-white/70 p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                <span>Ostatní týmy</span>
                <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                  {otherPlayers.length} hráčů
                </span>
              </summary>
              <div className="mt-4 space-y-3">
                {otherPlayers.length ? otherPlayers.map((player) => (
                  <div key={player.id} className="rounded-[20px] border border-[var(--line)] bg-white/70 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={resolveAvatarSrc(player)}
                          alt={formatPlayerName(player)}
                          className="h-12 w-12 rounded-[14px] border border-[var(--line)] bg-white object-cover"
                        />
                        <div>
                          <p className="font-medium">{formatPlayerName(player)}</p>
                          <p className="text-sm text-[var(--muted)]">
                            @{player.handle} · <span style={{ color: player.team.colorHex }}>{player.team.emoji} {player.team.name}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-sm font-semibold">💪 {formatPower(player.power)}</div>
                    </div>
                  </div>
                )) : (
                  <p className="rounded-[20px] border border-dashed border-[var(--line)] bg-white/55 p-4 text-sm text-[var(--muted)]">
                    Žádní další schválení hráči nebyli nalezeni.
                  </p>
                )}
              </div>
            </details>
          </div>
        </section>
      </div>
    </main>
  );
}
