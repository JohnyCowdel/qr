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
  maskData: Uint8ClampedArray | null;
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

function buildBaseSvgMarkup(svgText: string) {
  if (!svgText.trim()) {
    return "";
  }

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

function getAttr(node: Element, name: string) {
  return node.getAttribute(name) || node.getAttribute(`xlink:${name}`);
}

function parseDimension(value: string | null, fallback = 0) {
  const num = Number.parseFloat(value ?? "");
  return Number.isFinite(num) ? num : fallback;
}

function getSourceImageForUse(useNode: SVGUseElement, svgContainer: SVGSVGElement) {
  const href = getAttr(useNode, "href");
  if (!href || !href.startsWith("#")) {
    return null;
  }

  const sourceId = href.slice(1);
  const sourceImage = svgContainer.querySelector(`image[id="${sourceId}"]`);
  if (!sourceImage) {
    return null;
  }

  return {
    sourceId,
    hrefData: getAttr(sourceImage, "href"),
    width: parseDimension(sourceImage.getAttribute("width"), 1),
    height: parseDimension(sourceImage.getAttribute("height"), 1),
  };
}

function estimateUseArea(useNode: SVGUseElement, svgContainer: SVGSVGElement) {
  const source = getSourceImageForUse(useNode, svgContainer);
  if (!source) {
    return 0;
  }

  const renderWidth = parseDimension(useNode.getAttribute("width"), source.width);
  const renderHeight = parseDimension(useNode.getAttribute("height"), source.height);
  return Math.max(0, renderWidth) * Math.max(0, renderHeight);
}

async function renderMaskForUse(
  svgContainer: SVGSVGElement,
  useNode: SVGUseElement,
  targetWidth: number,
  targetHeight: number,
) {
  const cloneSvg = svgContainer.cloneNode(true) as SVGSVGElement;
  const allUseInClone = Array.from(cloneSvg.querySelectorAll("use"));
  const sourceHref = getAttr(useNode, "href");

  allUseInClone.forEach((u) => {
    const href = getAttr(u, "href");
    u.setAttribute("opacity", href === sourceHref ? "1" : "0");
  });

  const xml = new XMLSerializer().serializeToString(cloneSvg);
  const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);

  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = objectUrl;
    });

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return null;
    }
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
    return ctx.getImageData(0, 0, targetWidth, targetHeight).data;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
  const [hoveredSvgKey, setHoveredSvgKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const sceneRef = useRef<HTMLDivElement | null>(null);
  const interactiveBuildingsRef = useRef<InteractiveBuilding[]>([]);
  const hitTestWidthRef = useRef(0);
  const hitTestHeightRef = useRef(0);

  const spriteFile = useMemo(() => resolveSpriteFile(locationType), [locationType]);
  const bySvgKey = useMemo(() => new Map(items.map((item) => [item.svgKey, item])), [items]);
  const baseSvgMarkup = useMemo(() => buildBaseSvgMarkup(svgText), [svgText]);

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

  useEffect(() => {
    applyBuildingVisualState(interactiveBuildingsRef.current, bySvgKey, selectedSvgKey);
  }, [bySvgKey, selectedSvgKey]);

  useEffect(() => {
    let cancelled = false;

    async function attachInteractiveBuildings() {
      if (!sceneRef.current) {
        return;
      }

      const svgContainer = sceneRef.current.querySelector("svg") as SVGSVGElement | null;
      if (!svgContainer) {
        interactiveBuildingsRef.current = [];
        return;
      }

      const allUseNodes = Array.from(svgContainer.querySelectorAll("use")) as SVGUseElement[];
      const rankedByArea = allUseNodes
        .map((node) => ({
          node,
          area: estimateUseArea(node, svgContainer),
        }))
        .sort((a, b) => b.area - a.area);

      const backgroundCandidate = rankedByArea[0] ?? null;
      const interactiveNodes = backgroundCandidate
        ? allUseNodes.filter((node) => node !== backgroundCandidate.node)
        : allUseNodes;

      const rect = svgContainer.getBoundingClientRect();
      hitTestWidthRef.current = Math.max(1, Math.round(rect.width));
      hitTestHeightRef.current = Math.max(1, Math.round(rect.height));

      const interactiveBuildings: InteractiveBuilding[] = interactiveNodes.map((node, idx) => {
        const svgKey = `building${idx + 1}`;
        node.setAttribute("data-building-key", svgKey);
        node.style.pointerEvents = "none";
        return {
          id: svgKey,
          node,
          maskData: null,
        };
      });

      applyBuildingVisualState(interactiveBuildings, bySvgKey, selectedSvgKey);

      for (let i = 0; i < interactiveBuildings.length; i += 1) {
        if (cancelled) {
          return;
        }

        const building = interactiveBuildings[i];
        const source = getSourceImageForUse(building.node, svgContainer);
        if (!source?.hrefData) {
          continue;
        }

        building.maskData = await renderMaskForUse(
          svgContainer,
          building.node,
          hitTestWidthRef.current,
          hitTestHeightRef.current,
        );
      }

      interactiveBuildingsRef.current = interactiveBuildings;
    }

    void attachInteractiveBuildings();

    return () => {
      cancelled = true;
      interactiveBuildingsRef.current = [];
      hitTestWidthRef.current = 0;
      hitTestHeightRef.current = 0;
      setHoveredSvgKey(null);
    };
  }, [baseSvgMarkup, bySvgKey, selectedSvgKey]);

  function hitTestBuildingAtPointer(event: React.MouseEvent<HTMLDivElement>) {
    const svgContainer = sceneRef.current?.querySelector("svg") as SVGSVGElement | null;
    if (!svgContainer) {
      return null;
    }

    const rect = svgContainer.getBoundingClientRect();
    const hitTestWidth = hitTestWidthRef.current;
    const hitTestHeight = hitTestHeightRef.current;

    if (rect.width <= 0 || rect.height <= 0 || hitTestWidth <= 0 || hitTestHeight <= 0) {
      return null;
    }

    const x = Math.floor(((event.clientX - rect.left) / rect.width) * hitTestWidth);
    const y = Math.floor(((event.clientY - rect.top) / rect.height) * hitTestHeight);

    if (x < 0 || y < 0 || x >= hitTestWidth || y >= hitTestHeight) {
      return null;
    }

    const pxIndex = (y * hitTestWidth + x) * 4 + 3;
    const interactiveBuildings = interactiveBuildingsRef.current;
    for (let i = interactiveBuildings.length - 1; i >= 0; i -= 1) {
      const building = interactiveBuildings[i];
      if (building.maskData && building.maskData[pxIndex] > 36) {
        return building.id;
      }
    }

    return null;
  }

  function handleSvgClick(event: React.MouseEvent<HTMLDivElement>) {
    const hitBuildingId = hitTestBuildingAtPointer(event);
    setSelectedSvgKey(hitBuildingId);
    setStatus(null);
  }

  function handleSvgMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    const hitBuildingId = hitTestBuildingAtPointer(event);
    setHoveredSvgKey(hitBuildingId);
  }

  function handleSvgMouseLeave() {
    setHoveredSvgKey(null);
  }

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

  const builtCount = useMemo(() => items.filter((x) => x.isBuilt).length, [items]);
  const canAffordSelected = selectedBuilding ? (userMoney ?? 0) >= selectedBuilding.cost : false;
  const selectedEffects = useMemo(() => {
    if (!selectedBuilding) {
      return [] as string[];
    }

    const rows = [
      { value: selectedBuilding.effectMny, text: formatEffect("??", "Růst peněz", selectedBuilding.effectMny) },
      { value: selectedBuilding.effectPow, text: formatEffect("??", "Růst síly", selectedBuilding.effectPow) },
      { value: selectedBuilding.effectGpop, text: formatEffect("?????", "Růst populace", selectedBuilding.effectGpop) },
      { value: selectedBuilding.effectMaxpop, text: formatEffect("???", "Max. populace", selectedBuilding.effectMaxpop) },
      { value: selectedBuilding.effectArm, text: formatEffect("???", "Obrana", selectedBuilding.effectArm) },
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
      </div>

      {status ? <p className="mt-3 rounded-xl bg-emerald-100 px-3 py-2 text-sm text-emerald-800">{status}</p> : null}
      {error ? <p className="mt-3 rounded-xl bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p> : null}

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <div
          ref={sceneRef}
          onClick={handleSvgClick}
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={handleSvgMouseLeave}
          className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white/70 p-2"
          style={{ aspectRatio: sceneAspectRatio, cursor: hoveredSvgKey ? "pointer" : "default" }}
        >
          {baseSvgMarkup ? (
            <div
              className="qb-scene h-full w-full"
              dangerouslySetInnerHTML={{ __html: baseSvgMarkup }}
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

