import Link from "next/link";

import { LogoutButton } from "./logout-button";

export function AdminNav() {
  return (
    <nav className="flex items-center justify-between mb-8">
      <div className="flex items-center gap-2">
        <Link
          href="/admin"
          className="px-3 py-1.5 text-xs font-semibold border border-[var(--line)] rounded-lg hover:bg-[var(--background-strong)] transition-colors"
        >
          Lokace
        </Link>
        <Link
          href="/admin/players"
          className="px-3 py-1.5 text-xs font-semibold border border-[var(--line)] rounded-lg hover:bg-[var(--background-strong)] transition-colors"
        >
          Hráči
        </Link>
        <Link
          href="/admin/economy"
          className="px-3 py-1.5 text-xs font-semibold border border-[var(--line)] rounded-lg hover:bg-[var(--background-strong)] transition-colors"
        >
          Ekonomika
        </Link>
        <Link
          href="/admin/buildings"
          className="px-3 py-1.5 text-xs font-semibold border border-[var(--line)] rounded-lg hover:bg-[var(--background-strong)] transition-colors"
        >
          Budovy
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/admin/settings"
          className="px-3 py-1.5 text-xs font-semibold border border-[var(--line)] rounded-lg hover:bg-[var(--background-strong)] transition-colors"
        >
          Změnit heslo
        </Link>
        <LogoutButton />
      </div>
    </nav>
  );
}
