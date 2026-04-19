"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function DeleteLocationButton({
  slug,
  onDeleted,
}: {
  slug: string;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm(`Smazat "${slug}"? Všechny přidružené zábory budou také smazány.`)) return;
    startTransition(async () => {
      const response = await fetch(`/api/admin/locations/${slug}`, { method: "DELETE" });
      if (!response.ok) {
        return;
      }
      onDeleted?.();
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
    >
      {isPending ? "…" : "Smazat"}
    </button>
  );
}
