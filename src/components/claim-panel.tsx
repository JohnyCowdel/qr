"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useState, useTransition } from "react";

type ClaimPanelProps = {
  location: {
    id: number;
    slug: string;
    claimRadiusM: number;
    latitude: number;
    longitude: number;
    armor: number;
  };
  isOwner?: boolean;
  currentUser?: {
    handle: string;
    power: number;
    team: { name: string; emoji?: string | null };
  } | null;
  revengeDiscountExpiresAt?: string | null;
};

type ClaimResult = {
  ok: boolean;
  message: string;
  distanceM?: number;
};

type AuthState = {
  loading: boolean;
  authenticated: boolean;
  handle: string | null;
  teamLabel: string | null;
  power: number | null;
};

export function ClaimPanel({ location, isOwner = false, currentUser, revengeDiscountExpiresAt }: ClaimPanelProps) {
  const hasRevengeDiscount = Boolean(revengeDiscountExpiresAt);
  const claimCost = hasRevengeDiscount ? 0 : location.armor + 1;
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string>(() => currentUser ? "Přihlášen/a. Připraven/a ověřit polohu." : "Připraven ověřit polohu.");
  const [auth, setAuth] = useState<AuthState>(() => {
    if (currentUser) {
      return {
        loading: false,
        authenticated: true,
        handle: currentUser.handle,
        teamLabel: `${currentUser.team.emoji ?? ""} ${currentUser.team.name}`.trim(),
        power: currentUser.power,
      };
    }
    return {
      loading: !currentUser,
      authenticated: false,
      handle: null,
      teamLabel: null,
      power: null,
    };
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // If currentUser is provided via prop, skip fetching
    if (currentUser !== undefined) {
      return;
    }

    let cancelled = false;

    async function loadAuth() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = (await res.json()) as {
          authenticated: boolean;
          user?: { handle: string; power: number; team: { name: string; emoji?: string | null } };
        };

        if (cancelled) {
          return;
        }

        if (data.authenticated && data.user) {
          setAuth({
            loading: false,
            authenticated: true,
            handle: data.user.handle,
            teamLabel: `${data.user.team.emoji ?? ""} ${data.user.team.name}`.trim(),
            power: data.user.power,
          });
          setStatus("Přihlášen/a. Připraven/a ověřit polohu.");
          return;
        }

        setAuth({
          loading: false,
          authenticated: false,
          handle: null,
          teamLabel: null,
          power: null,
        });
        setStatus("Přihlaš se, abys mohl/a obsadit tuto lokaci.");
      } catch {
        if (!cancelled) {
          setAuth({
            loading: false,
            authenticated: false,
            handle: null,
            teamLabel: null,
            power: null,
          });
          setStatus("Relaci nelze ověřit. Zkus to znovu.");
        }
      }
    }

    loadAuth();

    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  async function submitClaim() {
    if (!auth.authenticated) {
      setStatus("Přihlaš se, abys mohl/a obsadit tuto lokaci.");
      return;
    }

    if (!navigator.geolocation) {
      setStatus("Tento prohlížeč neposkytuje GPS souřadnice.");
      return;
    }

    setStatus("Získatávám aktuální GPS polohu...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        startTransition(async () => {
          try {
            const response = await fetch("/api/claims", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                locationId: location.id,
                message,
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracyM: position.coords.accuracy,
              }),
            });

            const result = (await response.json()) as ClaimResult;

            if (!response.ok) {
              setStatus(result.message);
              return;
            }

            setStatus(
              `${result.message}${
                result.distanceM ? ` Ověřeno ve vzdálenosti ${result.distanceM.toFixed(1)} m.` : ""
              } Obnovte stránku, abyste viděli aktualizovaný feed.`,
            );
            setMessage("");
          } catch {
            setStatus("Zábor selhal. Zkus to znovu.");
          }
        });
      },
      (error) => {
        setStatus(error.message || "Nelze přečíst aktuální GPS polohu.");
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  }

  return (
    <section className="glass-panel rounded-[28px] border border-[var(--line)] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">Obsadit tento bod</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Server ověří, že tvá aktuální GPS polóha je do {location.claimRadiusM} m.
          </p>
        </div>
        <div className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          GPS zámek
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {hasRevengeDiscount && revengeDiscountExpiresAt ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
            ⚔️ Máš slevu pomsty! Tento bod ti byl ukraden – můžeš ho vzít zpět zdarma (⚡ 0) do{" "}
            {new Date(revengeDiscountExpiresAt).toLocaleTimeString("cs", { hour: "2-digit", minute: "2-digit" })}{" "}
            ({new Date(revengeDiscountExpiresAt).toLocaleDateString("cs")}).
          </div>
        ) : null}

        <div className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm">
          {auth.loading ? (
            <p className="text-[var(--muted)]">Ověřuji relaci...</p>
          ) : auth.authenticated ? (
            <p>
              Přihlášen/a jako <span className="font-semibold">{auth.handle}</span> ({auth.teamLabel}).
              {" "}Tvá síla: <span className={auth.power !== null && (hasRevengeDiscount || auth.power >= claimCost) ? "font-semibold text-green-700" : "font-semibold text-red-600"}>⚡ {auth.power?.toFixed(2) ?? "?"}</span>
              {hasRevengeDiscount
                ? <> / potřeba <span className="font-semibold line-through opacity-50">⚡ {location.armor + 1}</span> <span className="font-semibold text-amber-700">⚡ 0 (sleva pomsty)</span>.</>
                : <> / potřeba <span className="font-semibold">⚡ {claimCost}</span>.</>
              }
            </p>
          ) : (
            <p className="text-[var(--muted)]">
              Nejsi přihlášen/a. <Link href="/auth/login" className="font-semibold text-[var(--accent-strong)]">Přihlásit se</Link> nebo{" "}
              <Link href="/auth/register" className="font-semibold text-[var(--accent-strong)]">vytvořit účet</Link>.
            </p>
          )}
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Zpráva k záboru</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-28 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
            placeholder="Teď je naše."
          />
        </label>

        <button
          type="button"
          onClick={submitClaim}
          disabled={
            isPending ||
            auth.loading ||
            !auth.authenticated ||
            isOwner ||
            (!hasRevengeDiscount && auth.power !== null && auth.power < claimCost)
          }
          className="w-full rounded-full bg-[var(--accent)] px-5 py-3 font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? "Ověřuji polohu..."
            : isOwner
              ? "Již obsazeno"
              : !hasRevengeDiscount && auth.authenticated && auth.power !== null && auth.power < claimCost
                ? `Nedostatečná síla (potřeba ⚡ ${claimCost})`
                : hasRevengeDiscount
                  ? "⚔️ Vzít zpět (sleva pomsty · ⚡ 0)"
                  : `Obsadit ⚡ ${claimCost}`}
        </button>

        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white/45 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
          {status}
        </div>
      </div>
    </section>
  );
}