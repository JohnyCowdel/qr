"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

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
  userMoney?: number | null;
};

type InteractiveBuilding = {
  id: string;
  node: SVGUseElement;
};

function parseSvgDimensions(svg: Element) {
  const viewBox = svg.getAttribute("viewBox")?.trim();
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map((part) => Number.parseFloat(part));
    if (
      parts.length === 4 &&
      parts.every((part) => Number.isFinite(part)) &&
      parts[2] > 0 &&
      parts[3] > 0
    ) {
      return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
  }

  const rawWidth = Number.parseFloat(svg.getAttribute("width") ?? "");
  const rawHeight = Number.parseFloat(svg.getAttribute("height") ?? "");
  const width = Number.isFinite(rawWidth) && rawWidth > 0 ? rawWidth : 1;
  const height = Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : 1;

  return { x: 0, y: 0, width, height };
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

function namespaceSvgIds(svgRoot: Element, prefix: string) {
  const idMap = new Map<string, string>();

  svgRoot.querySelectorAll("[id]").forEach((el) => {
    const oldId = el.getAttribute("id")?.trim();
    if (!oldId) {
      return;
    }
    const newId = `${prefix}-${oldId}`;
    idMap.set(oldId, newId);
    el.setAttribute("id", newId);
  });

  if (idMap.size === 0) {
    return;
  }

  const rewriteValue = (value: string) => {
    let out = value;

    // Rewrite functional IRIs, e.g. clip-path="url(#clip0)"
    out = out.replace(/url\(#([^)]+)\)/g, (match, id) => {
      const mapped = idMap.get(String(id));
      return mapped ? `url(#${mapped})` : match;
    });

    // Rewrite direct hash references, e.g. href="#img1"
    if (out.startsWith("#")) {
      const mapped = idMap.get(out.slice(1));
      if (mapped) {
        return `#${mapped}`;
      }
    }

    return out;
  };

  svgRoot.querySelectorAll("*").forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const next = rewriteValue(attr.value);
      if (next !== attr.value) {
        el.setAttribute(attr.name, next);
      }
    });
  });
}

function formatViewBox(x: number, y: number, width: number, height: number) {
  return `${x} ${y} ${width} ${height}`;
}

function trySyncViewBoxFromBBox(svgContainer: SVGSVGElement) {
  try {
    const b = (svgContainer as unknown as SVGGraphicsElement).getBBox();
    if (
      Number.isFinite(b.x) &&
      Number.isFinite(b.y) &&
      Number.isFinite(b.width) &&
      Number.isFinite(b.height) &&
      b.width > 0 &&
      b.height > 0
    ) {
      svgContainer.setAttribute("viewBox", formatViewBox(b.x, b.y, b.width, b.height));
      return b.width / b.height;
    }
  } catch {
    // ignore
  }
  return null;
}

function applyBuildingVisualState(
  buildings: InteractiveBuilding[],
  bySvgKey: Map<string, BuildingItem>,
  selectedSvgKey: string | null,
) {
  buildings.forEach((building) => {
    const item = bySvgKey.get(building.id);
    building.node.classList.add("qb-building");
    building.node.classList.toggle("qb-building-built", Boolean(item?.isBuilt));
    building.node.classList.toggle("qb-building-unbuilt", !item?.isBuilt);
    building.node.classList.toggle("qb-building-selected", selectedSvgKey === building.id);
  });
}

function formatEffect(icon: string, label: string, value: number) {
  return `${icon} ${label}: +${value.toFixed(2)}`;
}

export function BuildingsPanel({ slug, canManage, locationType, userMoney: initialUserMoney }: Props) {
  const [items, setItems] = useState<BuildingItem[]>([]);
  const [userMoney, setUserMoney] = useState<number | null>(initialUserMoney ?? null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [svgText, setSvgText] = useState("");
  const [sceneAspectRatio, setSceneAspectRatio] = useState(16 / 10);
  const [selectedSvgKey, setSelectedSvgKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const fullscreenRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const svgIdPrefixRef = useRef(`qbsvg-${Math.random().toString(36).slice(2, 10)}`);
  const interactiveBuildingsRef = useRef<InteractiveBuilding[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const spriteFile = useMemo(() => resolveSpriteFile(locationType), [locationType]);
  const bySvgKey = useMemo(() => new Map(items.map((item) => [item.svgKey, item])), [items]);

  const selectedBuilding = useMemo(() => {
    if (!selectedSvgKey) {
      return null;
    }
    return items.find((item) => item.svgKey === selectedSvgKey) ?? null;
  }, [items, selectedSvgKey]);

  async function load() {
    try {
      const buildingsRes = await fetch(`/api/locations/${slug}/buildings`, { cache: "no-store" });

      if (!buildingsRes.ok) {
        throw new Error("Nepodařilo se načíst budovy.");
      }

      const data = (await buildingsRes.json()) as { ok: boolean; buildings: BuildingItem[] };
      setItems(data.buildings);

      if (initialUserMoney === undefined) {
        const meRes = await fetch("/api/auth/me", { cache: "no-store" });
        if (meRes.ok) {
          const me = (await meRes.json()) as {
            authenticated: boolean;
            user?: { money: number };
          };
          setUserMoney(me.authenticated ? (me.user?.money ?? null) : null);
        }
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
        const svgRes = await fetch(`/sprites/${spriteFile}`, { cache: "force-cache" });
        if (!svgRes.ok) {
          throw new Error("Nepodařilo se načíst SVG scénu.");
        }

        const text = await svgRes.text();
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

  useEffect(() => {
    function handleFullscreenChange() {
      const fullscreenElement = document.fullscreenElement;
      setIsFullscreen(fullscreenElement === fullscreenRef.current);
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    applyBuildingVisualState(interactiveBuildingsRef.current, bySvgKey, selectedSvgKey);
  }, [bySvgKey, selectedSvgKey]);

  useEffect(() => {
    if (!svgText.trim() || !svgRef.current) {
      return;
    }

    const parser = new DOMParser();
    const parsed = parser.parseFromString(svgText, "image/svg+xml");
    const sourceSvg = parsed.documentElement;
    const spritePrefix = `${svgIdPrefixRef.current}-${(spriteFile ?? "scene").replace(/[^a-z0-9]+/gi, "-")}`;
    namespaceSvgIds(sourceSvg, spritePrefix);
    const sourceViewBox = sourceSvg.getAttribute("viewBox")?.trim();
    const sourceWidth = sourceSvg.getAttribute("width") || "1920";
    const sourceHeight = sourceSvg.getAttribute("height") || "1080";

    const computedViewBox = sourceViewBox || `0 0 ${sourceWidth} ${sourceHeight}`;

    const svgContainer = svgRef.current;
    svgContainer.setAttribute("viewBox", computedViewBox);
    svgContainer.setAttribute("preserveAspectRatio", "xMidYMid meet");

    while (svgContainer.firstChild) {
      svgContainer.removeChild(svgContainer.firstChild);
    }

    Array.from(sourceSvg.children).forEach((child) => {
      svgContainer.appendChild(child.cloneNode(true));
    });

    // First sync attempt (works for simple sprites).
    const immediateRatio = trySyncViewBoxFromBBox(svgContainer);
    if (immediateRatio) {
      setSceneAspectRatio(immediateRatio);
    }

    // Second pass after paint/image decode; this fixes sprites that report bbox late.
    const rafId = window.requestAnimationFrame(() => {
      const ratio = trySyncViewBoxFromBBox(svgContainer);
      if (ratio) {
        setSceneAspectRatio(ratio);
      }
    });
    const timeoutId = window.setTimeout(() => {
      const ratio = trySyncViewBoxFromBBox(svgContainer);
      if (ratio) {
        setSceneAspectRatio(ratio);
      }
    }, 120);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };

  }, [svgText, spriteFile]);

  useEffect(() => {
    const svgContainer = svgRef.current;
    if (!svgContainer || !svgText.trim()) {
      return;
    }

    const syncFromBBox = () => {
      const ratio = trySyncViewBoxFromBBox(svgContainer);
      if (ratio) {
        setSceneAspectRatio((prev) => (Math.abs(prev - ratio) > 0.0001 ? ratio : prev));
      }
    };

    syncFromBBox();
    const rafId = window.requestAnimationFrame(syncFromBBox);
    const timeoutId = window.setTimeout(syncFromBBox, 250);
    window.addEventListener("resize", syncFromBBox);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
      window.removeEventListener("resize", syncFromBBox);
    };
  }, [svgText]);

  useEffect(() => {
    const svgContainer = svgRef.current;
    if (!svgContainer || !svgText.trim()) {
      return;
    }

    const allUseNodes = Array.from(svgContainer.querySelectorAll("use")) as SVGUseElement[];
    const interactiveNodes = allUseNodes.length > 1 ? allUseNodes.slice(1) : allUseNodes;

    const interactiveBuildings: InteractiveBuilding[] = interactiveNodes.map((node, idx) => {
      const svgKey = `building${idx + 1}`;
      node.setAttribute("data-building-key", svgKey);
      node.style.pointerEvents = "none";

      return { id: svgKey, node };
    });

    applyBuildingVisualState(interactiveBuildings, bySvgKey, selectedSvgKey);
    interactiveBuildingsRef.current = interactiveBuildings;

    return () => {
      interactiveBuildingsRef.current = [];
    };
  }, [svgText]);

  function build(buildingDefId: number) {
    setError(null);
    setStatus(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/locations/${slug}/buildings`, {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ buildingDefId }),
        });

        const data = (await res.json()) as { ok: boolean; message?: string };
        if (!res.ok || !data.ok) {
          throw new Error(data.message ?? "Stavba se nezdařila.");
        }

        setStatus(data.message ?? "Postaveno.");
        await load();
        window.dispatchEvent(new CustomEvent("buildings-updated", { detail: { slug } }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Stavba se nezdařila.");
      }
    });
  }

  async function toggleFullscreen() {
    if (document.fullscreenElement === fullscreenRef.current) {
      await document.exitFullscreen();
      return;
    }

    if (fullscreenRef.current) {
      await fullscreenRef.current.requestFullscreen();
    }
  }

  const builtCount = useMemo(() => items.filter((x) => x.isBuilt).length, [items]);
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const ax = Number.parseInt(a.svgKey.replace("building", ""), 10);
      const bx = Number.parseInt(b.svgKey.replace("building", ""), 10);
      if (Number.isFinite(ax) && Number.isFinite(bx)) {
        return ax - bx;
      }
      return a.svgKey.localeCompare(b.svgKey);
    });
  }, [items]);
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

  return (
    <section className="glass-panel rounded-[28px] border border-[var(--line)] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-[-0.03em]">Budovy</h2>
          <p className="text-sm text-[var(--muted)]">Obsazeno {builtCount}/{items.length} slotů</p>
        </div>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="rounded-full border border-[var(--line)] bg-white/70 px-3 py-1.5 text-xs font-semibold hover:bg-white"
        >
          {isFullscreen ? "Zavřít celou obrazovku" : "Celá obrazovka"}
        </button>
      </div>

      {status ? <p className="mt-3 rounded-xl bg-emerald-100 px-3 py-2 text-sm text-emerald-800">{status}</p> : null}
      {error ? <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <div
        ref={fullscreenRef}
        className={`qb-buildings-shell mt-4 ${isFullscreen ? "qb-buildings-shell-fullscreen" : ""}`}
      >
      {isFullscreen ? (
        <button
          type="button"
          onClick={toggleFullscreen}
          className="qb-buildings-exit rounded-full border border-[var(--line)] bg-white/90 px-3 py-1.5 text-xs font-semibold shadow-sm hover:bg-white"
        >
          Zavřít celou obrazovku
        </button>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr] qb-buildings-grid">
        <div
          className="qb-buildings-scene rounded-2xl border border-[var(--line)] bg-white/70"
          style={{ position: "relative" }}
        >
          {svgText ? (
            <svg
              ref={svgRef}
              className="qb-scene block w-full rounded-2xl"
              width="100%"
              preserveAspectRatio="xMidYMid meet"
              style={{ aspectRatio: sceneAspectRatio }}
            />
          ) : (
            null
          )}
          {!svgText ? (
            <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-[var(--line)] text-sm text-[var(--muted)]">
              {spriteFile ? "Načítám scénu..." : "Tento typ lokace nemá dostupné SVG budovy."}
            </div>
          ) : null}
        </div>

        <div className="qb-buildings-info rounded-2xl border border-[var(--line)] bg-white/70 p-4">
          <div className="space-y-2">
              {sortedItems.map((item) => {
                const isSelected = selectedSvgKey === item.svgKey;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedSvgKey(item.svgKey);
                      setStatus(null);
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition ${isSelected ? "border-[var(--accent)] bg-[var(--accent)]/10" : "border-[var(--line)] bg-white hover:bg-slate-50"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[var(--ink)]">{item.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${item.isBuilt ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                        {item.isBuilt ? "postaveno" : "nepostaveno"}
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>

          {selectedBuilding ? (
            <>
              <div className="mt-4 text-lg font-semibold">{selectedBuilding.name}</div>

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
              Klikni do obrázku pro nákup budov
            </div>
          )}
        </div>
      </div>
      </div>

      {!items.length ? (
        <div className="mt-4 rounded-xl border border-dashed border-[var(--line)] bg-white/60 p-3 text-sm text-[var(--muted)]">
          Pro tento typ lokace nejsou dostupné žádné budovy.
        </div>
      ) : null}

      <style jsx global>{`
        .qb-scene {
          width: 100%;
          height: auto;
          display: block;
          overflow: visible;
        }

        .qb-buildings-shell {
          position: relative;
        }

        .qb-buildings-exit {
          position: absolute;
          right: 12px;
          top: 12px;
          z-index: 10;
        }

        .qb-buildings-shell:fullscreen {
          width: 100vw;
          height: 100vh;
          padding: 24px;
          background: rgba(248, 244, 237, 0.98);
          overflow: auto;
        }

        .qb-buildings-shell:fullscreen .qb-buildings-grid {
          min-height: calc(100vh - 48px);
          align-items: stretch;
        }

        .qb-buildings-shell:fullscreen .qb-buildings-scene,
        .qb-buildings-shell:fullscreen .qb-buildings-info {
          min-height: calc(100vh - 48px);
        }

        .qb-buildings-shell:fullscreen .qb-buildings-scene {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .qb-buildings-shell:fullscreen .qb-scene {
          width: 100%;
          height: 100%;
          max-height: calc(100vh - 80px);
        }

        .qb-buildings-shell:fullscreen .qb-buildings-info {
          overflow: auto;
        }

        @media (max-width: 1023px) {
          .qb-buildings-shell:fullscreen .qb-buildings-grid {
            grid-template-columns: 1fr;
          }

          .qb-buildings-shell:fullscreen .qb-buildings-scene {
            min-height: 55vh;
          }

          .qb-buildings-shell:fullscreen .qb-buildings-info {
            min-height: auto;
          }
        }

        .qb-scene .qb-building {
          transition: opacity 0.15s ease, filter 0.15s ease;
        }

        .qb-scene .qb-building-unbuilt {
          opacity: 0.2;
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

