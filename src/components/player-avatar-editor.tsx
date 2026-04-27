"use client";

import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";

import { AVATAR_OPTION_COUNT, buildAvatarOptions, buildAvatarSpriteDataUrl } from "@/lib/avatar-sprites";

type PlayerAvatarEditorProps = {
  currentAvatarType: string;
  currentAvatarSprite: string;
  currentAvatarSeed: string | null;
  currentAvatarSrc: string;
  currentHandle: string;
};

export function PlayerAvatarEditor({
  currentAvatarType,
  currentAvatarSprite,
  currentAvatarSeed,
  currentAvatarSrc,
  currentHandle,
}: PlayerAvatarEditorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [avatarHistory, setAvatarHistory] = useState<string[][]>([]);
  const [sessionSeeds, setSessionSeeds] = useState<string[]>([]);
  const [selectedSeed, setSelectedSeed] = useState(currentAvatarSeed ?? `${currentHandle}-avatar`);
  const [previewSrc, setPreviewSrc] = useState(currentAvatarSrc);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function getFallbackSeed() {
    return currentAvatarSeed?.trim() || `${currentHandle}-avatar`;
  }

  function generateAvatarPage() {
    const sessionKey = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : `${Date.now()}`;
    const fallbackSeed = getFallbackSeed();
    return buildAvatarOptions(sessionKey, fallbackSeed, AVATAR_OPTION_COUNT);
  }

  function syncFallbackSeed(seeds: string[]) {
    const fallbackSeed = getFallbackSeed();
    const remainingSeeds = seeds.filter((seed) => seed !== fallbackSeed);
    return [fallbackSeed, ...remainingSeeds].slice(0, AVATAR_OPTION_COUNT);
  }

  function regenerateSessionAvatars() {
    setAvatarHistory((currentHistory) => {
      if (sessionSeeds.length === 0) {
        return currentHistory;
      }

      return [...currentHistory, sessionSeeds];
    });
    setSessionSeeds(generateAvatarPage());
    setError(null);
  }

  function showPreviousSessionAvatars() {
    setAvatarHistory((currentHistory) => {
      const previousPage = currentHistory.at(-1);
      if (!previousPage) {
        return currentHistory;
      }

      setSessionSeeds(previousPage);
      setError(null);
      return currentHistory.slice(0, -1);
    });
  }

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    setSelectedSeed(currentAvatarSeed ?? `${currentHandle}-avatar`);
    setPreviewSrc(currentAvatarSrc);
  }, [currentAvatarSeed, currentAvatarSrc, currentHandle]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (!isOpen) {
      return;
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const fallbackSeed = getFallbackSeed();
    setSessionSeeds((currentSeeds) => {
      if (currentSeeds.length === 0) {
        return generateAvatarPage();
      }

      return syncFallbackSeed(currentSeeds);
    });
    setSelectedSeed(fallbackSeed);
    setPreviewSrc(currentAvatarType === "photo" ? currentAvatarSrc : buildAvatarSpriteDataUrl(fallbackSeed));
    setError(null);
  }, [currentAvatarSeed, currentAvatarSrc, currentAvatarType, currentHandle, isOpen]);

  function submitSprite(seed: string) {
    setError(null);
    setSelectedSeed(seed);
    setPreviewSrc(buildAvatarSpriteDataUrl(seed));

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("mode", "sprite");
        formData.set("seed", seed);

        const res = await fetch("/api/auth/avatar", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError((data?.error as string | undefined) ?? "Nepodařilo se uložit sprite avatar.");
          return;
        }

        window.location.reload();
      } catch {
        setError("Network error. Try again.");
      }
    });
  }

  function resizeImage(file: File, maxSize: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Canvas unavailable")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Canvas toBlob failed"));
        }, "image/jpeg", 0.88);
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  function onPhotoSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError(null);
    const objectUrl = URL.createObjectURL(file);
    setPreviewSrc(objectUrl);

    startTransition(async () => {
      try {
        // Resize to max 256×256 before upload to reduce Transfer In.
        const resizedBlob = await resizeImage(file, 256);
        const resizedFile = new File([resizedBlob], file.name, { type: "image/jpeg" });

        const formData = new FormData();
        formData.set("mode", "photo");
        formData.set("photo", resizedFile);

        const res = await fetch("/api/auth/avatar", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError((data?.error as string | undefined) ?? "Nepodařilo se nahrát fotku.");
          return;
        }

        window.location.reload();
      } catch {
        setError("Network error. Try again.");
      }
    });
  }

  const modal = isOpen ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-[rgba(15,23,42,0.55)] px-4 py-6"
          onClick={() => setIsOpen(false)}
        >
          <section
            className="glass-panel relative z-[201] max-h-[calc(100vh-3rem)] w-full max-w-4xl overflow-y-auto rounded-[28px] border border-[var(--line)] p-5 sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Avatar profilu</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">Vyber svůj vzhled</h2>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Vyber jeden z vygenerovaných Dobrodruhořských avatarů, nebo nahrej fotku (PNG, JPG, WEBP do 1 MB).
                </p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Aktuální režim: {currentAvatarType === "photo" ? "Fotografie" : "Sprite"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-sm font-semibold hover:bg-[var(--background-strong)]"
              >
                Close
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-start gap-5">
              <img
                src={previewSrc}
                alt="Player avatar preview"
                className="h-28 w-28 rounded-[24px] border border-[var(--line)] bg-white object-cover"
              />

              <div className="min-w-[240px] flex-1">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Avatary dobrodruhů
                  </p>
                  <p className="mb-4 text-sm text-[var(--muted)]">
                    První možnost odpovídá tvému aktuálnímu spritu. Použij Další a Předchozí pro procházení {AVATAR_OPTION_COUNT - 1} variant bez resetování seznamu při znovuotevření.
                  </p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isPending || avatarHistory.length === 0}
                      onClick={showPreviousSessionAvatars}
                      className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--background-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      &lt;- Předchozích {AVATAR_OPTION_COUNT - 1}
                    </button>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={regenerateSessionAvatars}
                      className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--background-strong)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Dalších {AVATAR_OPTION_COUNT - 1} -&gt;
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {sessionSeeds.map((seed) => {
                    const src = buildAvatarSpriteDataUrl(seed);
                    const active = selectedSeed === seed && currentAvatarType !== "photo";
                    return (
                      <button
                        key={seed}
                        type="button"
                        disabled={isPending}
                        onClick={() => submitSprite(seed)}
                        className={`rounded-[18px] border p-2 text-center transition ${active ? "border-[var(--accent)] bg-[rgba(213,108,50,0.08)]" : "border-[var(--line)] bg-white hover:bg-[var(--background-strong)]"}`}
                      >
                        <img src={src} alt="Generated adventurer avatar" className="mx-auto h-14 w-14 rounded-[14px] border border-[var(--line)]" />
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="rounded-full border border-[var(--line)] bg-white px-4 py-2 text-sm font-semibold hover:bg-[var(--background-strong)]">
                    Nahrát fotku
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={onPhotoSelected}
                      className="hidden"
                    />
                  </label>
                  {isPending ? <span className="text-sm text-[var(--muted)]">Ukládám avatar...</span> : null}
                </div>

                {error ? (
                  <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </p>
                ) : null}
              </div>
            </div>
          </section>
        </div>
      ) : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="group relative overflow-hidden rounded-[20px] border border-[var(--line)] bg-white object-cover transition hover:scale-[1.02]"
      >
        <img
          src={currentAvatarSrc}
          alt="Player avatar"
          className="h-20 w-20 object-cover"
        />
        <span className="absolute inset-x-0 bottom-0 bg-[rgba(0,0,0,0.55)] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white opacity-0 transition group-hover:opacity-100">
          Change
        </span>
      </button>

      {isMounted && modal ? createPortal(modal, document.body) : null}
    </>
  );
}
