"use client";

import { useState, useTransition } from "react";

type Team = {
  id: number;
  slug: string;
  name: string;
  colorHex: string;
};

type ClaimPanelProps = {
  location: {
    id: number;
    slug: string;
    claimRadiusM: number;
    latitude: number;
    longitude: number;
  };
  teams: Team[];
};

type ClaimResult = {
  ok: boolean;
  message: string;
  distanceM?: number;
};

export function ClaimPanel({ location, teams }: ClaimPanelProps) {
  const [handle, setHandle] = useState("User1234");
  const [teamId, setTeamId] = useState<number>(teams[0]?.id ?? 0);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string>("Ready to verify position.");
  const [isPending, startTransition] = useTransition();

  async function submitClaim() {
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
                handle,
                teamId,
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
        <label className="block">
          <span className="mb-2 block text-sm font-medium">Player handle</span>
          <input
            value={handle}
            onChange={(event) => setHandle(event.target.value)}
            className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
            placeholder="User1234"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium">Team</span>
          <select
            value={teamId}
            onChange={(event) => setTeamId(Number(event.target.value))}
            className="w-full rounded-2xl border border-[var(--line)] bg-white/80 px-4 py-3 outline-none transition focus:border-[var(--accent)]"
          >
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        </label>

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
          disabled={isPending || !handle.trim() || !teamId}
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