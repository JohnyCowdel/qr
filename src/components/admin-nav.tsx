import Link from "next/link";

import { LogoutButton } from "./logout-button";

export function AdminNav() {
  return (
    <nav className="flex items-center justify-between mb-8">
      <Link
        href="/admin"
        className="text-xs font-mono uppercase tracking-widest text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
      >
        ← Admin
      </Link>
      <div className="flex items-center gap-2">
        <Link
          href="/admin/settings"
          className="px-3 py-1.5 text-xs font-semibold border border-[var(--line)] rounded-lg hover:bg-[var(--background-strong)] transition-colors"
        >
          Change password
        </Link>
        <LogoutButton />
      </div>
    </nav>
  );
}
