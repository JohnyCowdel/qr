"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function DeleteUserButton({
  userId,
  handle,
}: {
  userId: number;
  handle: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    if (!confirm(`Opravdu chcete hráče @${handle} smazat? Tato akce je nevratná.`)) {
      return;
    }

    startTransition(async () => {
      const response = await fetch(`/api/admin/users/${userId}/delete`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });

      if (!response.ok) {
        return;
      }

      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={isPending}
      className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-60"
    >
      {isPending ? "Mazání…" : "Smazat hráče"}
    </button>
  );
}
