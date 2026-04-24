import { AdminNav } from "@/components/admin-nav";
import { AdminTeamsManager } from "@/components/admin-teams-manager";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminTeamsPage() {
  const teams = await db.team.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      colorHex: true,
      emoji: true,
      isHidden: true,
      power: true,
      _count: { select: { users: true } },
    },
  });

  return (
    <main className="terrain-grid min-h-screen px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <AdminNav />
        <div className="mb-8">
          <p className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] mb-1">
            Správce
          </p>
          <h1 className="text-3xl font-bold">Týmy</h1>
        </div>
        <AdminTeamsManager initialTeams={teams} />
      </div>
    </main>
  );
}
