"use client";

import QRCode from "qrcode";
import { useEffect, useRef, useState } from "react";

type Location = {
  slug: string;
  name: string;
  summary?: string | null;
};

type PdfSettings = {
  titleSize: number;
  titleCharSpacing: number;
  summarySize: number;
  showSummary: boolean;
  perPage: 1 | 2 | 4;
  marginMm: number;
  gapMm: number;
};

const DEFAULT_SETTINGS: PdfSettings = {
  titleSize: 18,
  titleCharSpacing: 0.45,
  summarySize: 9,
  showSummary: true,
  perPage: 4,
  marginMm: 12,
  gapMm: 10,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

let fontInitPromise: Promise<boolean> | null = null;

async function ensureCzechPdfFonts(doc: {
  addFileToVFS: (name: string, data: string) => void;
  addFont: (postScriptName: string, id: string, style: string) => void;
}) {
  if (!fontInitPromise) {
    fontInitPromise = (async () => {
      try {
        const base = "/fonts/";
        const files = [
          { file: "NotoSerif-Regular.ttf", id: "NotoSerif", style: "normal" },
          { file: "NotoSerif-Italic.ttf", id: "NotoSerif", style: "italic" },
          { file: "NotoSerif-Bold.ttf", id: "NotoSerif", style: "bold" },
          { file: "NotoSerif-BoldItalic.ttf", id: "NotoSerif", style: "bolditalic" },
        ];

        const responses = await Promise.all(files.map((f) => fetch(base + f.file)));
        if (responses.some((r) => !r.ok)) return false;

        const buffers = await Promise.all(responses.map((r) => r.arrayBuffer()));

        files.forEach((f, i) => {
          doc.addFileToVFS(f.file, arrayBufferToBase64(buffers[i]));
          doc.addFont(f.file, f.id, f.style);
        });
        return true;
      } catch {
        return false;
      }
    })();
  }
  return fontInitPromise;
}

// ── PDF generation ────────────────────────────────────────────────────────────

async function generatePdf(locations: Location[], settings: PdfSettings) {
  const { jsPDF } = await import("jspdf");

  const PAGE_W = 210;
  const PAGE_H = 297;
  const { marginMm: MARGIN, gapMm: GAP, perPage } = settings;

  const COLS = perPage === 4 ? 2 : perPage === 2 ? 1 : 1;
  const ROWS = perPage === 4 ? 2 : perPage === 2 ? 2 : 1;

  const cellW = (PAGE_W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
  const cellH = (PAGE_H - MARGIN * 2 - GAP * (ROWS - 1)) / ROWS;
  const QR_SIZE = Math.min(cellW - 14, cellH - 46);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const czechReady = await ensureCzechPdfFonts(doc as unknown as {
    addFileToVFS: (name: string, data: string) => void;
    addFont: (postScriptName: string, id: string, style: string) => void;
  });
  const origin = window.location.origin;

  for (let i = 0; i < locations.length; i++) {
    const location = locations[i];

    if (i > 0 && i % perPage === 0) doc.addPage();

    const pageIndex = i % perPage;
    const col = pageIndex % COLS;
    const row = Math.floor(pageIndex / COLS);

    const x = MARGIN + col * (cellW + GAP);
    const y = MARGIN + row * (cellH + GAP);

    const dataUrl = await QRCode.toDataURL(`${origin}/l/${location.slug}`, {
      width: 512,
      margin: 1,
      color: { dark: "#1a2d21", light: "#ffffff" },
    });

    const qrX = x + (cellW - QR_SIZE) / 2;
    const qrY = y + 6;
    const centerX = qrX + QR_SIZE / 2;

    doc.addImage(dataUrl, "PNG", qrX, qrY, QR_SIZE, QR_SIZE);

    // Title
    doc.setFont(czechReady ? "NotoSerif" : "times", "bold");
    doc.setFontSize(settings.titleSize);
    doc.setCharSpace(settings.titleCharSpacing);
    doc.setTextColor(26, 45, 33);
    doc.text(location.name.toUpperCase(), centerX, qrY + QR_SIZE + 9, {
      align: "center",
      maxWidth: cellW - 8,
    });
    doc.setCharSpace(0);

    // Summary
    if (settings.showSummary) {
      const summary = (location.summary ?? "").trim();
      if (summary) {
        doc.setFont(czechReady ? "NotoSerif" : "times", "italic");
        doc.setFontSize(settings.summarySize);
        const lines = doc.splitTextToSize(summary, cellW - 10).slice(0, 4) as string[];
        doc.text(lines, centerX, qrY + QR_SIZE + 16, {
          align: "center",
          maxWidth: cellW - 10,
        });
      }
    }
  }

  doc.save("qr-codes.pdf");
}

// ── Slider row ────────────────────────────────────────────────────────────────

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[var(--muted)] w-36 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 accent-[var(--accent)]"
      />
      <span className="w-10 text-right font-mono text-xs">{value}</span>
    </label>
  );
}

// ── Preview cell ──────────────────────────────────────────────────────────────

const PREVIEW_CELL_PX = 240; // preview width in pixels (≈ one A4 cell)
const PREVIEW_DPI_RATIO = PREVIEW_CELL_PX / 88; // 88mm cellW → px

function PreviewCell({
  location,
  settings,
  qrDataUrl,
}: {
  location: Location;
  settings: PdfSettings;
  qrDataUrl: string | null;
}) {
  const titlePx = settings.titleSize * PREVIEW_DPI_RATIO * 0.35; // pt → px (1pt ≈ 0.35mm)
  const summaryPx = settings.summarySize * PREVIEW_DPI_RATIO * 0.35;
  const letterSpacing = `${settings.titleCharSpacing * 0.35 * PREVIEW_DPI_RATIO}px`;

  return (
    <div
      className="bg-white border border-[var(--line)] rounded-lg overflow-hidden shadow-md flex flex-col items-center p-3 gap-1"
      style={{ width: PREVIEW_CELL_PX }}
    >
      {qrDataUrl ? (
        <img
          src={qrDataUrl}
          alt="QR preview"
          style={{ width: PREVIEW_CELL_PX - 24, height: PREVIEW_CELL_PX - 24 }}
          className="rounded"
        />
      ) : (
        <div
          className="bg-[var(--background-strong)] rounded animate-pulse"
          style={{ width: PREVIEW_CELL_PX - 24, height: PREVIEW_CELL_PX - 24 }}
        />
      )}
      <p
        className="text-center leading-tight mt-1"
        style={{
          fontFamily: "'Noto Serif', serif",
          fontWeight: 700,
          fontSize: titlePx,
          letterSpacing,
          color: "#1a2d21",
          maxWidth: PREVIEW_CELL_PX - 16,
          wordBreak: "break-word",
        }}
      >
        {location.name.toUpperCase()}
      </p>
      {settings.showSummary && location.summary && (
        <p
          className="text-center leading-snug"
          style={{
            fontFamily: "'Noto Serif', serif",
            fontStyle: "italic",
            fontSize: summaryPx,
            color: "#1a2d21",
            maxWidth: PREVIEW_CELL_PX - 16,
          }}
        >
          {location.summary}
        </p>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function QrEditorClient({ locations }: { locations: Location[] }) {
  const [settings, setSettings] = useState<PdfSettings>(DEFAULT_SETTINGS);
  const [previewSlug, setPreviewSlug] = useState(locations[0]?.slug ?? "");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const qrAbortRef = useRef<AbortController | null>(null);

  const previewLocation = locations.find((l) => l.slug === previewSlug) ?? locations[0];

  // Regenerate QR preview whenever the selected location changes
  useEffect(() => {
    if (!previewLocation) return;
    qrAbortRef.current?.abort();
    const ctrl = new AbortController();
    qrAbortRef.current = ctrl;

    setQrDataUrl(null);
    QRCode.toDataURL(`${window.location.origin}/l/${previewLocation.slug}`, {
      width: 512,
      margin: 1,
      color: { dark: "#1a2d21", light: "#ffffff" },
    }).then((url) => {
      if (!ctrl.signal.aborted) setQrDataUrl(url);
    });

    return () => ctrl.abort();
  }, [previewLocation?.slug]);

  // Load Noto Serif for the HTML preview
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.querySelector("link[data-noto-serif]")) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Noto+Serif:ital,wght@0,400;0,700;1,400;1,700&display=swap";
    link.dataset.notoSerif = "1";
    document.head.appendChild(link);
  }, []);

  function set<K extends keyof PdfSettings>(key: K, value: PdfSettings[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function handleExport() {
    setGenerating(true);
    try {
      await generatePdf(locations, settings);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      {/* ── Settings panel ──────────────────────────────────── */}
      <div className="glass-panel rounded-[24px] border border-[var(--line)] p-5 flex flex-col gap-5 w-full lg:w-80 shrink-0">
        <h2 className="font-semibold text-sm uppercase tracking-widest text-[var(--muted)]">
          Nastavení
        </h2>

        {/* Preview location */}
        <div className="flex flex-col gap-1">
          <span className="text-xs text-[var(--muted)] font-medium">Náhled lokace</span>
          <select
            value={previewSlug}
            onChange={(e) => setPreviewSlug(e.target.value)}
            className="rounded-lg border border-[var(--line)] bg-white/60 px-3 py-1.5 text-sm"
          >
            {locations.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <hr className="border-[var(--line)]" />

        {/* Typography */}
        <div className="flex flex-col gap-3">
          <span className="text-xs text-[var(--muted)] font-medium uppercase tracking-wider">
            Typografie
          </span>
          <SliderRow
            label="Velikost názvu (pt)"
            value={settings.titleSize}
            min={10}
            max={28}
            onChange={(v) => set("titleSize", v)}
          />
          <SliderRow
            label="Mezery mezi pism."
            value={settings.titleCharSpacing}
            min={0}
            max={1.5}
            step={0.05}
            onChange={(v) => set("titleCharSpacing", v)}
          />
          <SliderRow
            label="Velikost shrnutí (pt)"
            value={settings.summarySize}
            min={6}
            max={14}
            onChange={(v) => set("summarySize", v)}
          />
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={settings.showSummary}
              onChange={(e) => set("showSummary", e.target.checked)}
              className="accent-[var(--accent)]"
            />
            <span className="text-[var(--muted)]">Zobrazit shrnutí</span>
          </label>
        </div>

        <hr className="border-[var(--line)]" />

        {/* Layout */}
        <div className="flex flex-col gap-3">
          <span className="text-xs text-[var(--muted)] font-medium uppercase tracking-wider">
            Rozvržení stránky
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-xs text-[var(--muted)]">QR kódů na stránku</span>
            <div className="flex gap-2">
              {([1, 2, 4] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => set("perPage", n)}
                  className={`flex-1 rounded-lg border py-1.5 text-sm font-medium transition-colors ${
                    settings.perPage === n
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--line)] hover:bg-white/80"
                  }`}
                >
                  {n}×
                </button>
              ))}
            </div>
          </div>
          <SliderRow
            label="Okraj stránky (mm)"
            value={settings.marginMm}
            min={4}
            max={24}
            onChange={(v) => set("marginMm", v)}
          />
          <SliderRow
            label="Mezera mezi buň. (mm)"
            value={settings.gapMm}
            min={2}
            max={20}
            onChange={(v) => set("gapMm", v)}
          />
        </div>

        <hr className="border-[var(--line)]" />

        {/* Export */}
        <button
          type="button"
          onClick={handleExport}
          disabled={generating || locations.length === 0}
          className="flex items-center justify-center gap-2 rounded-xl border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2.5 text-sm font-semibold text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/20 disabled:opacity-50"
        >
          {generating ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
              Generuji PDF…
            </>
          ) : (
            <>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                />
              </svg>
              Exportovat PDF ({locations.length} QR)
            </>
          )}
        </button>

        <p className="text-xs text-[var(--muted)] text-center">
          Použije nastavenou typografii pro všechny lokace
        </p>
      </div>

      {/* ── Preview panel ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="glass-panel rounded-[24px] border border-[var(--line)] p-5">
          <h2 className="font-semibold text-sm uppercase tracking-widest text-[var(--muted)] mb-4">
            Náhled
          </h2>

          {previewLocation ? (
            <div className="flex flex-wrap gap-6 items-start">
              <PreviewCell
                location={previewLocation}
                settings={settings}
                qrDataUrl={qrDataUrl}
              />
              <div className="flex flex-col gap-2 text-xs text-[var(--muted)] max-w-xs">
                <p className="font-medium text-[var(--foreground)]">
                  {previewLocation.name}
                </p>
                {previewLocation.summary && (
                  <p className="italic">{previewLocation.summary}</p>
                )}
                <p className="mt-2">
                  Náhled je aproximace — PDF může vypadat mírně odlišně kvůli rozdílům mezi
                  renderováním prohlížeče a jsPDF.
                </p>
                <p>
                  Font <strong>NotoSerif</strong> je načítán ze složky{" "}
                  <code className="bg-[var(--background-strong)] px-1 rounded">/fonts/</code>{" "}
                  — podporuje českou diakritiku.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-[var(--muted)] text-sm">Žádné lokace.</p>
          )}
        </div>

        {/* Mini grid preview hint */}
        <div className="glass-panel rounded-[24px] border border-[var(--line)] p-5">
          <h2 className="font-semibold text-sm uppercase tracking-widest text-[var(--muted)] mb-3">
            Rozvržení stránky ({settings.perPage} QR)
          </h2>
          <div
            className="bg-white border border-[var(--line)] rounded-lg overflow-hidden"
            style={{ width: 160, height: 226, padding: settings.marginMm * 0.76 }}
          >
            <div
              className="w-full h-full grid"
              style={{
                gridTemplateColumns: settings.perPage === 4 ? "1fr 1fr" : "1fr",
                gridTemplateRows:
                  settings.perPage === 1 ? "1fr" : settings.perPage === 2 ? "1fr 1fr" : "1fr 1fr",
                gap: settings.gapMm * 0.76,
              }}
            >
              {Array.from({ length: settings.perPage }).map((_, i) => (
                <div key={i} className="rounded border border-[var(--line)] bg-[var(--background-strong)] flex items-center justify-center">
                  <svg className="w-4 h-4 text-[var(--muted)]" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="2" y="2" width="8" height="8" rx="1" />
                    <rect x="14" y="2" width="8" height="8" rx="1" />
                    <rect x="2" y="14" width="8" height="8" rx="1" />
                    <rect x="14" y="14" width="8" height="8" rx="1" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
