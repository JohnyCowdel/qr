"use client";

import { useState } from "react";

type TeamData = {
  slug: string;
  name: string;
  colorHex: string;
  playerPower: number;
  claimedCount: number;
  users: Array<{
    id: number;
    handle: string;
    power: number;
    money: number;
    claimCount: number;
  }>;
};

type LeaderboardPanelProps = {
  teams: TeamData[];
};

function formatPower(power: number) {
  return power.toFixed(2);
}

function formatMoney(money: number) {
  return money.toFixed(0);
}

export function LeaderboardPanel({ teams }: LeaderboardPanelProps) {
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  const toggleTeam = (slug: string) => {
    const newExpanded = new Set(expandedTeams);
    if (newExpanded.has(slug)) {
      newExpanded.delete(slug);
    } else {
      newExpanded.add(slug);
    }
    setExpandedTeams(newExpanded);
  };

  return (
    <div className="space-y-3">
      {teams.map((team) => {
        const isExpanded = expandedTeams.has(team.slug);

        return (
          <div key={team.slug}>
            <button
              type="button"
              onClick={() => toggleTeam(team.slug)}
              className="w-full flex items-center justify-between rounded-[20px] border border-[var(--line)] bg-white/70 px-4 py-3 hover:bg-white transition"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-3.5 w-3.5 rounded-full"
                  style={{ backgroundColor: team.colorHex }}
                />
                <span className="font-medium">{team.name}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-sm text-[var(--muted)]">
                  {team.claimedCount} obsazeno · 💪 {formatPower(team.playerPower)}
                </span>
                <span className="text-[var(--muted)]">
                  {isExpanded ? "▼" : "▶"}
                </span>
              </div>
            </button>

            {isExpanded && (
              <div className="mt-2 ml-4 space-y-2 border-l-2 border-[var(--line)] pl-4">
                {team.users.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">Žádní aktivní hráči</p>
                ) : (
                  team.users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-[16px] bg-white/50 px-3 py-2 text-sm"
                    >
                      <span className="font-medium">{user.handle}</span>
                      <div className="flex items-center gap-4 font-mono text-xs text-[var(--muted)]">
                        <span>⚡ {formatPower(user.power)}</span>
                        <span>💰 {formatMoney(user.money)}</span>
                        <span>🚩 {user.claimCount}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
