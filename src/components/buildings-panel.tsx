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
  node: Element;
  maskData: Uint8ClampedArray | null;
};

// ---------------------------------------------------------------------------
// SVG helpers
// ---------------------------------------------------------------------------

function parseSvgDimensions(svg: Element): { x: number; y: number; width: number; height: number } {
  const viewBox = svg.getAttribute("viewBox")?.trim();
  if (viewBox) {
    const parts = viewBox.split(/[\s,]+/).map((p) => Number.parseFloat(p));
    if (parts.length === 4 && parts.every(Number.isFinite) && parts[2] > 0 && parts[3] > 0) {
      return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    }
  }
  const rawW = Number.parseFloat(svg.getAttribute("width") ?? "");
  const rawH = Number.parseFloat(svg.getAttribute("height") ?? "");
  return {
    x: 0,
    y: 0,
    width: Number.isFinite(rawW) && rawW > 0 ? rawW : 1,
    height: Number.isFinite(rawH) && rawH > 0 ? rawH : 1,
  };
}

function resolveSpriteFile(locationType: string): string | null {
  const n = String(locationType || "").trim().toLowerCase();
  if (n === "camp" || n === "camp1") return "camp1.svg";
  if (n === "mine" || n === "mine1") return "mine1.svg";
  if (n === "town" || n === "fortress" || n === "settlement") return "settlement8.svg";
  return null;
}

/** Prepare SVG for display: set viewBox, preserveAspectRatio, 100%/100% size only.
 *  Interactive classes are applied directly to the live DOM (not baked into the markup),
 *  so the SVG DOM node is stable across item/selection changes. */
function prepareSvgMarkup(svgText: string): string {
  if (!svgText.trim()) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.documentElement;
  const { x, y, width, height } = parseSvgDimensions(svg);
  if (!svg.getAttribute("viewBox")) {
    svg.setAttribute("viewBox", `${x} ${y} ${width} ${height}`);
  }
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  return new XMLSerializer().serializeToString(svg);
}

function getAttr(node: Element, name: string): string | null {
  return node.getAttribute(name) || node.getAttribute(`xlink:${name}`);
}

function parseDimension(value: string | null, fallback = 0): number {
  const n = Number.parseFloat(value ?? "");
  return Number.isFinite(n) ? n : fallback;
}

/** Estimate rendered area of a <use> node — used to identify the background layer. */
function estimateUseArea(useNode: Element, svgEl: Element): number {
  const href = getAttr(useNode, "href");
  if (!href?.startsWith("#")) return 0;
  const src = svgEl.querySelector(`image[id="${href.slice(1)}"]`);
  if (!src) return 0;
  const sw = parseDimension(src.getAttribute("width"), 1);
  const sh = parseDimension(src.getAttribute("height"), 1);
  const rw = parseDimension(useNode.getAttribute("width"), sw);
  const rh = parseDimension(useNode.getAttribute("height"), sh);
  return Math.max(0, rw) * Math.max(0, rh);
}

/**
 * Render a single <use> layer in isolation to a canvas and return the alpha channel.
 * All other <use> nodes are hidden (opacity=0) so only the target building is visible.
 */
async function renderMaskForUse(
  svgEl: SVGSVGElement,
  useNode: Element,
  w: number,
  h: number,
): Promise<Uint8ClampedArray | null> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement;
  const targetHref = getAttr(useNode, "href");
  for (const u of Array.from(clone.querySelectorAll("use"))) {
    u.setAttribute("opacity", getAttr(u, "href") === targetHref ? "1" : "0");
  }
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h).data;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Apply built/selected CSS classes to building <use> nodes in the live DOM. */
function applyVisualState(
  buildings: InteractiveBuilding[],
  items: BuildingItem[],
  selectedKey: string | null,
) {
  const itemMap = new Map(items.map((item) => [item.svgKey, item]));
  for (const b of buildings) {
    const item = itemMap.get(b.id);
    b.node.classList.toggle("qb-building-built", !!item?.isBuilt);
    b.node.classList.toggle("qb-building-unbuilt", !item?.isBuilt);
    b.node.classList.toggle("qb-building-selected", b.id === selectedKey);
  }
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

function formatEffect(icon: string, label: string, value: number) {
  return `${icon} ${label}: +${value.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BuildingsPanel({ slug, canManage, locationType, userMoney: initialUserMoney }: Props) {
  const [items, setItems] = useState<BuildingItem[]>([]);
  const [userMoney, setUserMoney] = useState<number | null>(initialUserMoney ?? null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [svgText, setSvgText] = useState("");
  const [sceneAspectRatio, setSceneAspectRatio] = useState(16 / 10);
  const [selectedSvgKey, setSelectedSvgKey] = useState<string | null>(null);
  const [hoveredSvgKey, setHoveredSvgKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const spriteFile = useMemo(() => resolveSpriteFile(locationType), [locationType]);

  // prepareSvgMarkup is pure — no interactive state baked in, so SVG DOM is stable
  // until the sprite file itself changes. CSS classes are applied via direct DOM mutations.
  const svgMarkup = useMemo(() => prepareSvgMarkup(svgText), [svgText]);

  // DOM refs for hit-testing — updating these must not trigger re-renders
  const sceneRef = useRef<HTMLDivElement>(null);
  const svgElRef = useRef<SVGSVGElement | null>(null);
  const masksRef = useRef<InteractiveBuilding[]>([]);
  const hitSizeRef = useRef({ w: 0, h: 0 });
  const hoveredKeyRef = useRef<string | null>(null);

  // Mirror state into refs so async mask-building closures read the latest values
  const selectedKeyRef = useRef<string | null>(null);
  const itemsRef = useRef<BuildingItem[]>([]);
  useEffect(() => { selectedKeyRef.current = selectedSvgKey; }, [selectedSvgKey]);
  useEffect(() => { itemsRef.current = items; }, [items]);

  // -------------------------------------------------------------------------
  // Build alpha masks once per sprite (expensive async work)
  // -------------------------------------------------------------------------
  useEffect(() => {
    masksRef.current = [];
    hitSizeRef.current = { w: 0, h: 0 };
    svgElRef.current = null;

    if (!svgMarkup || !sceneRef.current) return;

    let cancelled = false;
    const container = sceneRef.current;

    async function buildMasks() {
      const svgEl = container.querySelector("svg") as SVGSVGElement | null;
      if (!svgEl) return;

      svgElRef.current = svgEl;

      const allUseNodes = Array.from(svgEl.querySelectorAll("use"));

      // Rank <use> nodes by area; the largest is the background — exclude it
      const ranked = [...allUseNodes]
        .map((node) => ({ node, area: estimateUseArea(node, svgEl) }))
        .sort((a, b) => b.area - a.area);

      const bgNode = ranked[0]?.node ?? null;
      const interactiveNodes = bgNode
        ? allUseNodes.filter((n) => n !== bgNode)
        : allUseNodes;

      const buildings: InteractiveBuilding[] = interactiveNodes.map((node, idx) => {
        const id = `building${idx + 1}`;
        node.setAttribute("data-building-key", id);
        node.classList.add("qb-building");
        // Disable SVG pointer-events so all mouse events bubble to the container div
        (node as SVGElement).style.pointerEvents = "none";
        return { id, node, maskData: null };
      });

      masksRef.current = buildings;
      // Apply visual classes synchronously before async masks are ready
      applyVisualState(buildings, itemsRef.current, selectedKeyRef.current);

      const rect = svgEl.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      hitSizeRef.current = { w, h };

      for (const b of buildings) {
        if (cancelled) return;
        try {
          b.maskData = await renderMaskForUse(svgEl, b.node, w, h);
        } catch {
          // mask stays null — building is visible but not clickable
        }
      }
    }

    void buildMasks();
    return () => { cancelled = true; };
  }, [svgMarkup]);

  // Keep CSS classes in sync whenever items or selection changes
  useEffect(() => {
    applyVisualState(masksRef.current, items, selectedSvgKey);
  }, [items, selectedSvgKey]);

  // Deselect if the selected building is removed
  useEffect(() => {
    if (selectedSvgKey && !items.some((item) => item.svgKey === selectedSvgKey)) {
      setSelectedSvgKey(null);
    }
  }, [items, selectedSvgKey]);

  // -------------------------------------------------------------------------
  // Pixel-perfect hit testing via alpha masks
  // -------------------------------------------------------------------------
  function hitTest(clientX: number, clientY: number): string | null {
    const svgEl = svgElRef.current;
    if (!svgEl) return null;
    const rect = svgEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const { w, h } = hitSizeRef.current;
    if (w <= 0 || h <= 0) return null;

    const x = Math.floor(((clientX - rect.left) / rect.width) * w);
    const y = Math.floor(((clientY - rect.top) / rect.height) * h);
    if (x < 0 || y < 0 || x >= w || y >= h) return null;

    // Alpha channel index: (row * width + col) * 4 + 3
    const pxIdx = (y * w + x) * 4 + 3;
    const buildings = masksRef.current;
    // Iterate in reverse so the topmost (last-painted) layer wins on overlap
    for (let i = buildings.length - 1; i >= 0; i--) {
      const b = buildings[i];
      if (b.maskData && b.maskData[pxIdx] > 36) return b.id;
    }
    return null;
  }

  function handleClick(event: React.MouseEvent<HTMLDivElement>) {
    const hit = hitTest(event.clientX, event.clientY);
    setSelectedSvgKey(hit ?? null);
    setStatus(null);
  }

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const hit = hitTest(event.clientX, event.clientY);
    // Only update state when hovered building actually changes to avoid excess re-renders
    if (hit !== hoveredKeyRef.current) {
      hoveredKeyRef.current = hit;
      setHoveredSvgKey(hit);
    }
  }

  function handleMouseLeave() {
    hoveredKeyRef.current = null;
    setHoveredSvgKey(null);
  }

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------
  const selectedBuilding = useMemo(() => {
    if (!selectedSvgKey) return null;
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

      // Only fetch user money if not provided via prop
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
        window.dispatchEvent(new CustomEvent("buildings-updated", { detail: { slug } }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Stavba se nezdařila.");
      }
    });
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
          ref={sceneRef}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white/70 p-2"
          style={{ aspectRatio: sceneAspectRatio, cursor: hoveredSvgKey ? "pointer" : "default" }}
        >
          {svgMarkup ? (
            <div
              className="qb-scene h-full w-full"
              dangerouslySetInnerHTML={{ __html: svgMarkup }}
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
              Klikni do obrázku pro nákup budov
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
