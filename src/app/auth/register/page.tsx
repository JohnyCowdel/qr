import { db } from "@/lib/db";
import { RegisterForm } from "@/components/register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const teams = await db.team.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, colorHex: true },
  });

  return (
    <main className="terrain-grid min-h-screen px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <section className="glass-panel rounded-[28px] border border-[var(--line)] p-6 sm:p-7">
          <p className="text-xs font-mono uppercase tracking-widest text-[var(--muted)]">Territory QR</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em]">Vytvořit účet</h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Zaregistruj se, zvol tým a počkej na schválení správcem.
          </p>
          <RegisterForm teams={teams} />
        </section>
      </div>
    </main>
  );
}
