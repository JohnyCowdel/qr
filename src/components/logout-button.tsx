"use client";

import { useTransition } from "react";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(async () => {
      await fetch("/api/admin/logout", { method: "POST" });
      window.location.href = "/admin/login";
    });
  }

  return (
    <button
      onClick={handleLogout}
      disabled={isPending}
      className="px-3 py-1.5 text-xs font-semibold border border-[var(--line)] rounded-lg hover:bg-[var(--background-strong)] transition-colors disabled:opacity-50"
    >
      {isPending ? "…" : "Odhlásit se"}
    </button>
  );
}
