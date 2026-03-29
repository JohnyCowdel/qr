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
  };
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
};

export function ClaimPanel({ location }: ClaimPanelProps) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string>("Ready to verify position.");
  const [auth, setAuth] = useState<AuthState>({
    loading: true,
    authenticated: false,
    handle: null,
    teamName: null,
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
          });
          setStatus("Signed in. Ready to verify position.");
          return;
        }

        setAuth({
          loading: false,
          authenticated: false,
          handle: null,
          teamName: null,
        });
        setStatus("Sign in to claim this location.");
      } catch {
        if (!cancelled) {
          setAuth({
            loading: false,
            authenticated: false,
            handle: null,
            teamName: null,
          });
          setStatus("Could not verify your session. Try again.");
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
      setStatus("Sign in to claim this location.");
      return;
    }

    if (!navigator.geolocation) {
      setStatus("This browser does not expose GPS coordinates.");
      return;
    }

    setStatus("Requesting current GPS position...");

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
                result.distanceM ? ` Verified at ${result.distanceM.toFixed(1)} m.` : ""
              } Refresh to see the updated feed.`,
            );
            setMessage("");
          } catch {
            setStatus("Claim request failed. Try again.");
          }
        });
      },
      (error) => {
        setStatus(error.message || "Unable to read current GPS position.");
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
          <h2 className="text-2xl font-semibold tracking-[-0.03em]">Claim this point</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            The server checks that your live GPS reading is within {location.claimRadiusM} m.
          </p>
        </div>
        <div className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1 font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
          GPS lock
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="rounded-2xl border border-[var(--line)] bg-white/70 px-4 py-3 text-sm">
          {auth.loading ? (
            <p className="text-[var(--muted)]">Checking active session...</p>
          ) : auth.authenticated ? (
            <p>
              Signed in as <span className="font-semibold">{auth.handle}</span> ({auth.teamName}).
            </p>
          ) : (
            <p className="text-[var(--muted)]">
              Not signed in. <Link href="/auth/login" className="font-semibold text-[var(--accent-strong)]">Sign in</Link> or{" "}
              <Link href="/auth/register" className="font-semibold text-[var(--accent-strong)]">create an account</Link>.
            </p>
          )}
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Claim message</span>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            className="min-h-28 w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
            placeholder="Now it's ours. Move in from the north ridge."
          />
        </label>

        <button
          type="button"
          onClick={submitClaim}
          disabled={isPending || auth.loading || !auth.authenticated}
          className="w-full rounded-full bg-[var(--accent)] px-5 py-3 font-medium text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? "Verifying position..." : "Share GPS and claim"}
        </button>

        <div className="rounded-2xl border border-dashed border-[var(--line)] bg-white/45 px-4 py-3 text-sm leading-6 text-[var(--muted)]">
          {status}
        </div>
      </div>
    </section>
  );
}