import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { USER_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth";
import { AutoRefresh } from "@/components/auto-refresh";
import { ClaimEventCard } from "@/components/claim-event-card";
import { PlayerAvatarEditor } from "@/components/player-avatar-editor";
import { resolveAvatarSrc } from "@/lib/avatar-sprites";
import { db } from "@/lib/db";
import { runEconomyTick } from "@/lib/economy";

export const dynamic = "force-dynamic";

function formatPower(power: number) {
  return power.toFixed(2);
}

function formatMoney(money: number) {
  return `$${money.toFixed(2)}`;
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

  const [teamPlayers, otherPlayers, claimedPositions] = await Promise.all([
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
          },
        },
      },
      orderBy: [
        { teamId: "asc" },
        { power: "desc" },
        { handle: "asc" },
      ],
    }),
    db.location.findMany({
      where: {
        ownerTeamId: { not: null },
      },
      include: {
        ownerTeam: {
          select: {
            name: true,
            colorHex: true,
          },
        },
      },
      orderBy: [
        { lastClaimedAt: "desc" },
        { name: "asc" },
      ],
    }),
  ]);

  const currentAvatarSrc = resolveAvatarSrc(user);

  return (
    <main className="terrain-grid min-h-screen px-4 py-8 sm:px-6 lg:px-8">
      <AutoRefresh intervalMs={5000} />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex justify-end">
          <Link href="/" className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Back to map
          </Link>
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
                <p className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Player profile</p>
                <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em]">{user.handle}</h1>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Team: <span className="font-medium" style={{ color: user.team.colorHex }}>{user.team.name}</span>
                </p>
              </div>
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
              <div className="mt-2 text-2xl font-semibold">💪 {formatPower(user.power)}</div>
            </div>
            <div className="rounded-[20px] border border-[var(--line)] bg-white/70 p-4">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Money</div>
              <div className="mt-2 text-2xl font-semibold">💰 {formatMoney(user.money)}</div>
            </div>
            <div className="rounded-[20px] border border-[var(--line)] bg-white/70 p-4">
              <div className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Total claims</div>
              <div className="mt-2 text-2xl font-semibold">{user.claims.length}</div>
            </div>
          </div>

          <div className="mt-3 rounded-[20px] border border-[var(--line)] bg-white/70 p-4 text-sm">
            <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Profile details</p>
            <p className="mt-2">
              {user.firstName ?? "-"} {user.lastName ?? "-"} · {user.email ?? "-"} · age {user.age ?? "-"} · resource pop {Math.round(user.population)}
            </p>
          </div>
        </section>

        <section className="glass-panel rounded-[30px] border border-[var(--line)] p-6 sm:p-7">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">Your team</h2>
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
                          <p className="text-sm text-[var(--muted)]">@{player.handle}{player.id === user.id ? " · you" : ""}</p>
                        </div>
                      </div>
                      <div className="text-sm font-semibold">💪 {formatPower(player.power)}</div>
                    </div>
                  </div>
                )) : (
                  <p className="rounded-[20px] border border-dashed border-[var(--line)] bg-white/55 p-4 text-sm text-[var(--muted)]">
                    No approved teammates found.
                  </p>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.03em]">Other players</h2>
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
                            @{player.handle} · <span style={{ color: player.team.colorHex }}>{player.team.name}</span>
                          </p>
                        </div>
                      </div>
                      <div className="text-sm font-semibold">💪 {formatPower(player.power)}</div>
                    </div>
                  </div>
                )) : (
                  <p className="rounded-[20px] border border-dashed border-[var(--line)] bg-white/55 p-4 text-sm text-[var(--muted)]">
                    No other approved players found.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel rounded-[30px] border border-[var(--line)] p-6 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">All claimed positions</h2>
            <span className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
              {claimedPositions.length} claimed
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {claimedPositions.length ? claimedPositions.map((position) => (
              <div key={position.id} className="rounded-[20px] border border-[var(--line)] bg-white/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{position.image} {position.name}</p>
                    <p className="text-sm text-[var(--muted)]">
                      {position.ownerTeam ? (
                        <>
                          Owner: <span style={{ color: position.ownerTeam.colorHex }}>{position.ownerTeam.name}</span>
                        </>
                      ) : (
                        "Owner: Neutral"
                      )}
                    </p>
                  </div>
                  <div className="text-right text-xs text-[var(--muted)]">
                    <p className="font-mono uppercase tracking-[0.12em]">Last claimed</p>
                    <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
                      {position.lastClaimedAt ? formatDate(position.lastClaimedAt.toISOString()) : "-"}
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
                No positions have been claimed yet.
              </p>
            )}
          </div>
        </section>

        <section className="glass-panel rounded-[30px] border border-[var(--line)] p-6 sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-semibold tracking-[-0.03em]">Your recent claims</h2>
          </div>
          <div className="mt-4 space-y-3">
            {user.claims.length ? user.claims.map((claim) => (
              <ClaimEventCard
                key={claim.id}
                user={user}
                message={claim.message}
                actionHref={`/l/${claim.location.slug}`}
                summary={(
                  <>
                    claimed <span className="font-medium">{claim.location.name}</span> for <span className="font-medium">{claim.team.name}</span> on {formatDate(claim.createdAt.toISOString())}.
                  </>
                )}
              />
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
