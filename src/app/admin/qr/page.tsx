import { AdminNav } from "@/components/admin-nav";
import { QrEditorClient } from "@/components/qr-editor-client";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminQrPage() {
  const locations = await db.location.findMany({
    select: { slug: true, name: true, summary: true },
    orderBy: { name: "asc" },
  });

  return (
    <main className="terrain-grid min-h-screen px-4 py-10">
      <div className="max-w-6xl mx-auto">
        <AdminNav />
        <div className="mb-8">
          <p className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] mb-1">
            Správce
          </p>
          <h1 className="text-3xl font-bold">Editor QR kódů</h1>
        </div>
        <QrEditorClient locations={locations} />
      </div>
    </main>
  );
}
