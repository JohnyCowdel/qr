import { AdminNav } from "@/components/admin-nav";
import { AdminLocationsManager } from "@/components/admin-locations-manager";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [locations, teams] = await Promise.all([
    db.location.findMany({
      include: { ownerTeam: true },
      orderBy: { name: "asc" },
    }),
    db.team.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        colorHex: true,
        emoji: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <main className="terrain-grid min-h-screen px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <AdminNav />
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] mb-1">
              Správce
            </p>
            <h1 className="text-3xl font-bold">Lokace</h1>
          </div>
        </div>

        <AdminLocationsManager initialLocations={locations} initialTeams={teams} />

        <p className="mt-6 text-xs text-[var(--muted)] text-center">
          Chráněná administrativní oblast. Uchovej heslo a tajný klíč relace v bezpečí.
        </p>
      </div>
    </main>
  );
}
