"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

type BuildingItem = {
  id: number;
  name: string;
  svgKey: string;
  locationType: string;
  cost: number;
  effectGpop: number;
  effectPow: number;
  effectMaxpop: number;
  effectMny: number;
  effectArm: number;
  isBuilt: boolean;
  builtAt: string | null;
};

type Props = {
  slug: string;
  canManage: boolean;
  locationType: string;
};

function parseSvgDimensions(svg: Element) {
  const rawWidth = Number.parseFloat(svg.getAttribute("width") ?? "");
  const rawHeight = Number.parseFloat(svg.getAttribute("height") ?? "");
  const width = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : 1;
  const height = Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : 1;

  return { width, height };
}

function resolveSpriteFile(locationType: string): string | null {
  const normalized = String(locationType || "").trim().toLowerCase();

  if (normalized === "camp" || normalized === "camp1") {
    return "camp1.svg";
  }
  if (normalized === "mine" || normalized === "mine1") {
    return "mine1.svg";
  }
  if (normalized === "town" || normalized === "fortress" || normalized === "settlement") {
    return "settlement8.svg";
  }

  return null;
}

function buildInteractiveSvgMarkup(svgText: string, items: BuildingItem[], selectedSvgKey: string | null) {
  if (!svgText.trim()) {
    return "";
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.documentElement;
  const { width, height } = parseSvgDimensions(svg);

  // Normalize the root sizing so the scene always scales into its container.
  if (!svg.getAttribute("viewBox")) {
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");

  const useNodes = Array.from(svg.querySelectorAll("use"));
  const interactiveNodes = useNodes.slice(1, 1 + items.length);

  const bySvgKey = new Map(items.map((item) => [item.svgKey, item]));

  interactiveNodes.forEach((node, idx) => {
    const svgKey = `building${idx + 1}`;
    const item = bySvgKey.get(svgKey);
    if (!item) {
      return;
    }

    node.setAttribute("data-building-key", svgKey);
    node.classList.add("qb-building");
    node.classList.toggle("qb-building-built", item.isBuilt);
    node.classList.toggle("qb-building-unbuilt", !item.isBuilt);
    node.classList.toggle("qb-building-selected", selectedSvgKey === svgKey);
  });

  return new XMLSerializer().serializeToString(svg);
}

function formatEffect(icon: string, label: string, value: number) {
  return `${icon} ${label}: +${value.toFixed(2)}`;
}

export function BuildingsPanel({ slug, canManage, locationType }: Props) {
  const [items, setItems] = useState<BuildingItem[]>([]);
  const [userMoney, setUserMoney] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [svgText, setSvgText] = useState("");
  const [sceneAspectRatio, setSceneAspectRatio] = useState(16 / 10);
  const [selectedSvgKey, setSelectedSvgKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const spriteFile = useMemo(() => resolveSpriteFile(locationType), [locationType]);

  const selectedBuilding = useMemo(() => {
    if (!selectedSvgKey) {
      return null;
    }
    return items.find((item) => item.svgKey === selectedSvgKey) ?? null;
  }, [items, selectedSvgKey]);

  const interactiveSvg = useMemo(() => buildInteractiveSvgMarkup(svgText, items, selectedSvgKey), [items, selectedSvgKey, svgText]);

  async function load() {
    try {
      const [buildingsRes, meRes] = await Promise.all([
        fetch(`/api/locations/${slug}/buildings`, { cache: "no-store" }),
        fetch("/api/auth/me", { cache: "no-store" }),
      ]);

      if (!buildingsRes.ok) {
        throw new Error("Nepodařilo se načíst budovy.");
      }

      const data = (await buildingsRes.json()) as { ok: boolean; buildings: BuildingItem[] };
      setItems(data.buildings);

      if (meRes.ok) {
        const me = (await meRes.json()) as {
          authenticated: boolean;
          user?: { money: number };
        };
        setUserMoney(me.authenticated ? (me.user?.money ?? null) : null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nepodařilo se načíst budovy.");
    }
  }

  useEffect(() => {
    void load();
  }, [slug]);

  useEffect(() => {
    if (!spriteFile) {
      setSvgText("");
      return;
    }

    let cancelled = false;

    async function loadSprite() {
      try {
        const res = await fetch(`/api/sprites/${spriteFile}`, { cache: "no-store" });
        if (!res.ok) {
          throw new Error("Nepodařilo se načíst SVG scénu.");
        }

        const text = await res.text();
        const parsed = new DOMParser().parseFromString(text, "image/svg+xml");
        const svgRoot = parsed.documentElement;
        const { width, height } = parseSvgDimensions(svgRoot);
        if (!cancelled) {
          setSceneAspectRatio(width / height);
          setSvgText(text);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Nepodařilo se načíst SVG scénu.");
        }
      }
    }

    void loadSprite();

    return () => {
      cancelled = true;
    };
  }, [spriteFile]);

  useEffect(() => {
    if (selectedSvgKey && !items.some((item) => item.svgKey === selectedSvgKey)) {
      setSelectedSvgKey(null);
    }
  }, [items, selectedSvgKey]);

  const builtCount = useMemo(() => items.filter((x) => x.isBuilt).length, [items]);
  const canAffordSelected = selectedBuilding ? (userMoney ?? 0) >= selectedBuilding.cost : false;
  const selectedEffects = useMemo(() => {
    if (!selectedBuilding) {
      return [] as string[];
    }

    const rows = [
      { value: selectedBuilding.effectMny, text: formatEffect("💰", "Růst peněz", selectedBuilding.effectMny) },
      { value: selectedBuilding.effectPow, text: formatEffect("💪", "Růst síly", selectedBuilding.effectPow) },
      { value: selectedBuilding.effectGpop, text: formatEffect("👨‍🌾", "Růst populace", selectedBuilding.effectGpop) },
      { value: selectedBuilding.effectMaxpop, text: formatEffect("🏘️", "Max. populace", selectedBuilding.effectMaxpop) },
      { value: selectedBuilding.effectArm, text: formatEffect("🛡️", "Obrana", selectedBuilding.effectArm) },
    ];

    return rows
      .filter((row) => Math.abs(row.value) > 1e-9)
      .map((row) => row.text);
  }, [selectedBuilding]);

  function build(buildingDefId: number) {
    setError(null);
    setStatus(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/locations/${slug}/buildings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buildingDefId }),
        });

        const data = (await res.json()) as { ok: boolean; message?: string };
        if (!res.ok || !data.ok) {
          throw new Error(data.message ?? "Stavba se nezdařila.");
        }

        setStatus(data.message ?? "Postaveno.");
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Stavba se nezdařila.");
      }
    });
  }

  function handleSvgClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as Element | null;
    if (!target) {
      return;
    }

    const node = target.closest("[data-building-key]") as Element | null;
    if (!node) {
      return;
    }

    const key = node.getAttribute("data-building-key");
    if (!key) {
      return;
    }

    setSelectedSvgKey(key);
    setStatus(null);
  }

  return (
    <section className="glass-panel rounded-[28px] border border-[var(--line)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em]">Budovy</h2>
          <p className="text-sm text-[var(--muted)]">Obsazeno {builtCount}/{items.length} slotů</p>
        </div>
      </div>

      {status ? <p className="mt-3 rounded-xl bg-emerald-100 px-3 py-2 text-sm text-emerald-800">{status}</p> : null}
      {error ? <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <div
          onClick={handleSvgClick}
          className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white/70 p-2"
          style={{ aspectRatio: sceneAspectRatio }}
        >
          {interactiveSvg ? (
            <div
              className="qb-scene h-full w-full"
              dangerouslySetInnerHTML={{ __html: interactiveSvg }}
            />
          ) : (
            <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-[var(--line)] text-sm text-[var(--muted)]">
              {spriteFile ? "Načítám scénu..." : "Tento typ lokace nemá dostupné SVG budovy."}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-white/70 p-4">
          {selectedBuilding ? (
            <>
              <div className="text-lg font-semibold">{selectedBuilding.name}</div>

              <div className="mt-3 space-y-1 text-sm text-[var(--muted)]">
                {selectedEffects.length ? (
                  selectedEffects.map((line) => <div key={line}>{line}</div>)
                ) : (
                  <div>Tato budova nemá aktivní bonusy.</div>
                )}
              </div>

              {selectedBuilding.isBuilt ? (
                <div className="mt-4 rounded-lg bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">
                  Budova je postavená
                </div>
              ) : canManage ? (
                <button
                  type="button"
                  onClick={() => build(selectedBuilding.id)}
                  disabled={isPending || !canAffordSelected}
                  className="mt-4 w-full rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--accent-strong)] disabled:opacity-60"
                >
                  Koupit za {selectedBuilding.cost.toFixed(0)} $
                </button>
              ) : (
                <div className="mt-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
                  Budovu může koupit jen vlastník lokace.
                </div>
              )}

              {canManage && !selectedBuilding.isBuilt ? (
                <div className="mt-2 text-xs text-[var(--muted)]">
                  Stav konta: {(userMoney ?? 0).toFixed(2)} $ {!canAffordSelected ? "(nedostatek peněz)" : ""}
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-sm text-[var(--muted)]">
              Klikni doobrázku pro nákup budov
            </div>
          )}
        </div>
      </div>

      {!items.length ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-white/60 p-3 text-sm text-[var(--muted)]">
          Pro tento typ lokace nejsou dostupné žádné budovy.
        </div>
      ) : null}

      <style jsx global>{`
        .qb-scene svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .qb-scene .qb-building {
          cursor: pointer;
          transition: opacity 0.15s ease, filter 0.15s ease;
        }

        .qb-scene .qb-building-unbuilt {
          opacity: 0.08;
        }

        .qb-scene .qb-building-built {
          opacity: 1;
        }

        .qb-scene .qb-building-selected {
          opacity: 1;
          filter: brightness(1.06) drop-shadow(0 0 6px rgba(18, 55, 39, 0.35));
        }
      `}</style>
    </section>
  );
}
