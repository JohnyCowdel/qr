import { AdminLocationForm } from "@/components/admin-location-form";

export default function NewLocationPage() {
  return (
    <main className="terrain-grid min-h-screen px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] mb-1">
          Admin
        </p>
        <h1 className="text-2xl font-bold mb-8">New Location</h1>
        <div className="glass-panel rounded-xl p-6">
          <AdminLocationForm mode="create" />
        </div>
      </div>
    </main>
  );
}
