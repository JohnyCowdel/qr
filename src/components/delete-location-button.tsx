"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function DeleteLocationButton({
  slug,
  locationLabel,
  onDeleted,
}: {
  slug: string;
  locationLabel?: string;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    const target = (locationLabel && locationLabel.trim()) || slug;
    if (!confirm(`Opravdu chcete oblast "${target}" smazat? Tato akce je nevratná a smaže i přidružené zábory.`)) return;
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
