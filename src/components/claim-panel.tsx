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
  teamName: string | null;
  power: number | null;
};

export function ClaimPanel({ location, isOwner = false }: ClaimPanelProps) {
  const claimCost = location.armor + 1;
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string>("Připraven ověřit polohu.");
  const [auth, setAuth] = useState<AuthState>({
    loading: true,
    authenticated: false,
    handle: null,
    teamName: null,
    power: null,
  });
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;

    async function loadAuth() {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = (await res.json()) as {
          authenticated: boolean;
          user?: { handle: string; team: { name: string } };
        };

        if (cancelled) {
          return;
        }

        if (data.authenticated && data.user) {
          setAuth({
            loading: false,
            authenticated: true,
            handle: data.user.handle,
            teamName: data.user.team.name,
            power: data.user.power,
          });
          setStatus("Přihlášen/a. Připraven/a ověřit polohu.");
          return;
        }

        setAuth({
          loading: false,
          authenticated: false,
          handle: null,
          teamName: null,
          power: null,
        });
        setStatus("Přihlaš se, abys mohl/a obsadit tuto lokaci.");
      } catch {
        if (!cancelled) {
          setAuth({
            loading: false,
            authenticated: false,
            handle: null,
            teamName: null,
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
  }, []);

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
        <div className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm">
          {auth.loading ? (
            <p className="text-[var(--muted)]">Ověřuji relaci...</p>
          ) : auth.authenticated ? (
            <p>
              Přihlášen/a jako <span className="font-semibold">{auth.handle}</span> ({auth.teamName}).
              {" "}Tvá síla: <span className={auth.power !== null && auth.power >= claimCost ? "font-semibold text-green-700" : "font-semibold text-red-600"}>⚡ {auth.power?.toFixed(2) ?? "?"}</span>
              {" "}/ potřeba <span className="font-semibold">⚡ {claimCost}</span>.
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
            placeholder="Teď je naše. Postupujte ze severního hřebene."
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
            (auth.power !== null && auth.power < claimCost)
          }
          className="w-full rounded-full bg-[var(--accent)] px-5 py-3 font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending
            ? "Ověřuji polohu..."
            : isOwner
              ? "Již obsazeno"
              : auth.authenticated && auth.power !== null && auth.power < claimCost
                ? `Nedostatečná síla (potřeba ⚡ ${claimCost})`
                : `Obsadit ⚡ ${claimCost}`}
        </button>

        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white/45 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
          {status}
        </div>
      </div>
    </section>
  );
}