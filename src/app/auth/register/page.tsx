import Link from "next/link";
import { db } from "@/lib/db";
import { RegisterForm } from "@/components/register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const [teams, settings] = await Promise.all([
    db.team.findMany({
    where: { isHidden: false },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      colorHex: true,
      emoji: true,
      users: {
        where: {
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
          power: true,
        },
      },
    },
    }),
    db.adminSettings.findUnique({ where: { id: 1 }, select: { registrationsOpen: true } }),
  ]);
  const registrationsOpen = settings?.registrationsOpen ?? true;

  return (
    <main className="terrain-grid min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-3 flex justify-end">
          <Link href="/" className="rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)]">
            Zpět na mapu
          </Link>
        </div>
        <section className="glass-panel rounded-[28px] border border-[var(--line)] p-6 sm:p-7">
          <p className="text-xs font-mono uppercase tracking-widest text-[var(--muted)]">Territory QR</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em]">Vytvořit účet</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Zaregistruj se, zvol tým a počkej na schválení správcem.
          </p>
          {!registrationsOpen ? (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Registrace jsou momentálně uzavřené.
            </p>
          ) : null}
          <RegisterForm teams={teams} registrationsOpen={registrationsOpen} />
        </section>
      </div>
    </main>
  );
}
