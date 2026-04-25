import { AdminNav } from "@/components/admin-nav";
import { DeleteUserButton } from "@/components/delete-user-button";
import { db } from "@/lib/db";

function formatDate(date: Date | null) {
  if (!date) {
    return "Bez aktivit";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatPower(power: number) {
  return power.toFixed(2);
}

function formatMoney(money: number) {
  return `$${money.toFixed(2)}`;
}

function buildUserWhere(search: string, teamSlug: string) {
  const and: Array<Record<string, unknown>> = [];

  if (search) {
    and.push({
      OR: [
        { handle: { contains: search } },
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
      ],
    });
  }

  if (teamSlug !== "all") {
    and.push({
      team: {
        slug: teamSlug,
      },
    });
  }

  return and.length ? { AND: and } : {};
}

function EditPlayerDropdown({
  user,
  teams,
}: {
  user: {
    id: number;
    handle: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    age: number | null;
    power: number;
    money: number;
    teamId: number;
    isApproved: boolean;
  };
  teams: Array<{ id: number; name: string; emoji: string; colorHex?: string }>;
}) {
  return (
    <details className="w-full rounded-2xl border border-[var(--line)] bg-[rgba(255,255,255,0.55)] px-4 py-3">
      <summary className="cursor-pointer text-sm font-semibold text-[var(--accent-strong)]">
        Upravit hráče
      </summary>
      <form action={`/api/admin/users/${user.id}`} method="post" className="mt-4 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Přezdívka</span>
            <input name="handle" defaultValue={user.handle} required className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Email</span>
            <input name="email" type="email" defaultValue={user.email ?? ""} required className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Jméno</span>
            <input name="firstName" defaultValue={user.firstName ?? ""} required className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Příjmení</span>
            <input name="lastName" defaultValue={user.lastName ?? ""} required className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Věk</span>
            <input name="age" type="number" min="6" max="120" defaultValue={user.age ?? 18} required className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Síla</span>
            <input name="power" type="number" min="0" step="0.01" defaultValue={user.power} required className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Money</span>
            <input name="money" type="number" min="0" step="0.01" defaultValue={user.money} required className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Tým</span>
            <select name="teamId" defaultValue={String(user.teamId)} className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]">
              {teams.map((team) => (
                <option key={team.id} value={team.id}>{team.emoji} {team.name}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex items-center gap-3 text-sm font-medium">
          <input type="checkbox" name="isApproved" defaultChecked={user.isApproved} className="h-4 w-4 rounded border-[var(--line)]" />
          Hráč schválen
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Nové heslo</span>
          <input
            name="newPassword"
            type="password"
            minLength={6}
            placeholder="Nechat prázdné beze změny"
            className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <span className="mt-1 block text-xs text-[var(--muted)]">
            Pokud pole vyplníš, hráči se nastaví nové heslo.
          </span>
        </label>

        <div className="flex justify-end">
          <button type="submit" className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Uložit změny
          </button>
        </div>

        <details className="rounded-xl border border-red-200 bg-red-50/40 px-3 py-2">
          <summary className="cursor-pointer text-sm font-semibold text-red-700">
            Nebezpečné akce
          </summary>
          <div className="mt-3">
            <DeleteUserButton userId={user.id} handle={user.handle} />
          </div>
        </details>
      </form>
    </details>
  );
}

export default async function AdminPlayersPage(props: PageProps<"/admin/players">) {
  const searchParams = await props.searchParams;
  const search = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const teamFilter = typeof searchParams.team === "string" && searchParams.team ? searchParams.team : "all";
  const status = typeof searchParams.status === "string" ? searchParams.status : "";
  const baseWhere = buildUserWhere(search, teamFilter);

  const [teams, pendingUsers, approvedUsers] = await Promise.all([
    db.team.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        emoji: true,
      },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: {
        ...baseWhere,
        isApproved: false,
        passwordHash: { not: null },
      },
      select: {
        id: true, handle: true, firstName: true, lastName: true, email: true,
        age: true, power: true, money: true, teamId: true, isApproved: true, createdAt: true,
        team: { select: { id: true, name: true, colorHex: true, emoji: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.user.findMany({
      where: {
        ...baseWhere,
        isApproved: true,
        passwordHash: { not: null },
      },
      select: {
        id: true, handle: true, firstName: true, lastName: true, email: true,
        age: true, power: true, money: true, teamId: true, isApproved: true,
        team: { select: { id: true, name: true, colorHex: true, power: true, emoji: true } },
        claims: {
          select: { id: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        _count: { select: { claims: true } },
      },
      orderBy: [{ updatedAt: "desc" }, { handle: "asc" }],
    }),
  ]);

  return (
    <main className="terrain-grid min-h-screen px-4 py-10">
      <div className="max-w-5xl mx-auto">
        <AdminNav />

        <div className="mb-8">
          <p className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] mb-1">
            Správce
          </p>
          <h1 className="text-3xl font-bold">Hráči</h1>
        </div>

        {status === "password-reset" ? (
          <p className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            Heslo hráče bylo úspěšně změněno.
          </p>
        ) : null}

        {status === "user-saved" ? (
          <p className="mb-6 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
            Změny hráče byly uloženy.
          </p>
        ) : null}

        <section className="mb-8 rounded-3xl border border-[var(--line)] bg-white/70 p-5">
          <form method="get" className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-end">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Hledat hráče
              </span>
              <input
                type="text"
                name="q"
                defaultValue={search}
                placeholder="Přezdívka, jméno nebo e-mail"
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Filtr týmu
              </span>
              <select
                name="team"
                defaultValue={teamFilter}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
              >
                <option value="all">Všechny týmy</option>
                {teams.map((team) => (
                  <option key={team.slug} value={team.slug}>
                    {team.emoji} {team.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex gap-2">
              <button
                type="submit"
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
              >
                Použít
              </button>
              <a
                href="/admin/players"
                className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--background-strong)]"
              >
                Resetovat
              </a>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border border-[var(--line)] bg-white/70 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Schválení žadatelů</h2>
            <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 font-mono text-xs uppercase tracking-wide text-[var(--muted)]">
              {pendingUsers.length} čekajících
            </span>
          </div>

          <div className="space-y-3">
            {pendingUsers.length ? (
              pendingUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white p-4"
                >
                  <div className="space-y-1">
                    <p className="font-semibold">
                      {user.firstName ?? "?"} {user.lastName ?? "?"} · @{user.handle}
                    </p>
                    <p className="text-sm text-[var(--muted)]">
                      {user.email ?? "Bez e-mailu"} · věk {user.age ?? "?"} · tým{" "}
                      <span style={{ color: user.team.colorHex }}>{user.team.emoji} {user.team.name}</span>
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      Registrován/a {formatDate(user.createdAt)}
                    </p>
                    <EditPlayerDropdown user={user} teams={teams} />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <form action={`/api/admin/users/${user.id}/reject`} method="post">
                      <button
                        type="submit"
                        className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
                      >
                        Zamítnout
                      </button>
                    </form>
                    <form action={`/api/admin/users/${user.id}/approve`} method="post">
                      <button
                        type="submit"
                        className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
                      >
                        Approve
                      </button>
                    </form>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-[var(--line)] bg-white/60 px-4 py-3 text-sm text-[var(--muted)]">
                No players are waiting for approval.
              </p>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-[var(--line)] bg-white/70 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Approved and active players</h2>
            <span className="rounded-full border border-[var(--line)] bg-white px-3 py-1 font-mono text-xs uppercase tracking-wide text-[var(--muted)]">
              {approvedUsers.length} approved
            </span>
          </div>

          <div className="space-y-3">
            {approvedUsers.length ? (
              approvedUsers.map((user) => {
                const lastClaimAt = user.claims[0]?.createdAt ?? null;
                const isActive = user._count.claims > 0;

                return (
                  <div
                    key={user.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line)] bg-white p-4"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">
                          {user.firstName ?? "?"} {user.lastName ?? "?"} · @{user.handle}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            isActive
                              ? "bg-[rgba(47,125,93,0.12)] text-[#255943]"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {isActive ? "Active" : "Approved"}
                        </span>
                      </div>
                      <p className="text-sm text-[var(--muted)]">
                        {user.email ?? "No email"} · age {user.age ?? "?"} · team{" "}
                        <span style={{ color: user.team.colorHex }}>{user.team.emoji} {user.team.name}</span> · player 💪 {formatPower(user.power)} · {formatMoney(user.money)}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        Claims: {user._count.claims} · Last activity: {formatDate(lastClaimAt)}
                      </p>
                      <EditPlayerDropdown user={user} teams={teams} />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="rounded-2xl border border-dashed border-[var(--line)] bg-white/60 px-4 py-3 text-sm text-[var(--muted)]">
                No approved players yet.
              </p>
            )}
          </div>
        </section>

        <p className="mt-6 text-xs text-[var(--muted)] text-center">
          Protected admin area. Keep your admin password and session secret private.
        </p>
      </div>
    </main>
  );
}
