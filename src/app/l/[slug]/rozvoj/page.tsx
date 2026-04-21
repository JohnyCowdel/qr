import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { AutoRefresh } from "@/components/auto-refresh";
import { BuildingsPanel } from "@/components/buildings-panel";
import { LandscapeHelper } from "@/components/landscape-helper";
import { LocationEconomyControls } from "@/components/location-economy-controls";
import { USER_COOKIE_NAME, verifyUserSessionToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLocationPageData } from "@/lib/game";

function formatPower(power: number) {
  return power.toFixed(2);
}

export default async function LocationDevelopmentPage(props: PageProps<"/l/[slug]/rozvoj">) {
  const { slug } = await props.params;
  const data = await getLocationPageData(slug);
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_COOKIE_NAME)?.value;
  const userId = token ? verifyUserSessionToken(token) : null;
  const currentUser = userId
    ? await db.user.findUnique({
        where: { id: userId },
        include: { team: true },
      })
    : null;

  if (!data) {
    notFound();
  }

  const { location } = data;
  const locationEconomy = location as typeof location & {
    popToMoney?: number;
    popToPower?: number;
    popToPopulation?: number;
  };

  const canManageEconomy = Boolean(currentUser && location.ownerUser && currentUser.id === location.ownerUser.id);

  return (
    <main className="terrain-grid min-h-screen px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <AutoRefresh intervalMs={5000} />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 sm:gap-6">
        {currentUser ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Link
                href={`/l/${location.slug}`}
                className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
              >
                Zpět na lokaci
              </Link>
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
                className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
              >
                {currentUser.team.name} {currentUser.handle} · 💪 {formatPower(currentUser.power)}
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Link
              href={`/l/${location.slug}`}
              className="rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-sm font-semibold hover:bg-white"
            >
              Zpět na lokaci
            </Link>
            <Link
              href="/auth/login"
              className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]"
            >
              Přihlásit se
            </Link>
          </div>
        )}

        <section className="glass-panel rounded-[24px] border border-[var(--line)] p-4 sm:rounded-[28px] sm:p-5">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">Rozvoj lokace: {location.name}</h1>
          <p className="mt-2 text-sm text-[var(--muted)] sm:text-base">
            Samostatná obrazovka pro správu budov a dělníků. Na mobilu můžeš přepnout do režimu na šířku pro pohodlnější práci se scénou.
          </p>
        </section>

        <LandscapeHelper />

        {canManageEconomy ? (
          <LocationEconomyControls
            slug={location.slug}
            currentPopulation={location.currentPopulation}
            maxPopulation={location.maxPopulation}
            popToMoney={locationEconomy.popToMoney ?? 0}
            popToPower={locationEconomy.popToPower ?? 0}
            popToPopulation={locationEconomy.popToPopulation ?? 30}
          />
        ) : (
          <section className="glass-panel rounded-[24px] border border-[var(--line)] p-4 sm:rounded-[28px] sm:p-5">
            <p className="text-sm text-[var(--muted)]">
              Přiřazení zdrojů i nákup budov může měnit pouze vlastník lokace.
            </p>
          </section>
        )}

        <BuildingsPanel slug={location.slug} canManage={canManageEconomy} locationType={location.type} />
      </div>
    </main>
  );
}
