"use client";

import QRCode from "qrcode";
import { useState } from "react";

let fontInitPromise: Promise<boolean> | null = null;

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

async function ensureCzechPdfFonts(doc: {
  addFileToVFS: (name: string, data: string) => void;
  addFont: (postScriptName: string, id: string, style: string) => void;
}) {
  if (!fontInitPromise) {
    fontInitPromise = (async () => {
      try {
        const regularUrl = "https://github.com/notofonts/noto-fonts/raw/main/hinted/ttf/NotoSerif/NotoSerif-Regular.ttf";
        const italicUrl = "https://github.com/notofonts/noto-fonts/raw/main/hinted/ttf/NotoSerif/NotoSerif-Italic.ttf";

        const [regularRes, italicRes] = await Promise.all([
          fetch(regularUrl),
          fetch(italicUrl),
        ]);

        if (!regularRes.ok || !italicRes.ok) {
          return false;
        }

        const [regularBuffer, italicBuffer] = await Promise.all([
          regularRes.arrayBuffer(),
          italicRes.arrayBuffer(),
        ]);

        doc.addFileToVFS("NotoSerif-Regular.ttf", arrayBufferToBase64(regularBuffer));
        doc.addFont("NotoSerif-Regular.ttf", "NotoSerif", "normal");

        doc.addFileToVFS("NotoSerif-Italic.ttf", arrayBufferToBase64(italicBuffer));
        doc.addFont("NotoSerif-Italic.ttf", "NotoSerif", "italic");

        return true;
      } catch {
        return false;
      }
    })();
  }

  return fontInitPromise;
}

type Location = {
  slug: string;
  name: string;
  summary?: string | null;
};

type Props = {
  locations: Location[];
};

export function GenerateQRPdfButton({ locations }: Props) {
  const [generating, setGenerating] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { jsPDF } = await import("jspdf");

      // A4 in mm: 210 x 297
      const PAGE_W = 210;
      const PAGE_H = 297;
      const MARGIN = 12;
      const COLS = 2;
      const ROWS = 2;
      const GAP_X = 10;
      const GAP_Y = 10;

      const cellW = (PAGE_W - MARGIN * 2 - GAP_X * (COLS - 1)) / COLS;
      const cellH = (PAGE_H - MARGIN * 2 - GAP_Y * (ROWS - 1)) / ROWS;
      const QR_SIZE = Math.min(cellW - 14, cellH - 46);

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const origin = window.location.origin;
      const czechFontReady = await ensureCzechPdfFonts(doc as unknown as {
        addFileToVFS: (name: string, data: string) => void;
        addFont: (postScriptName: string, id: string, style: string) => void;
      });

      for (let i = 0; i < locations.length; i++) {
        const location = locations[i];

        // Exactly 4 QR codes per page (2x2 grid).
        if (i > 0 && i % (COLS * ROWS) === 0) {
          doc.addPage();
        }

        const pageIndex = i % (COLS * ROWS);
        const col = pageIndex % COLS;
        const row = Math.floor(pageIndex / COLS);

        const x = MARGIN + col * (cellW + GAP_X);
        const y = MARGIN + row * (cellH + GAP_Y);

        // Generate QR code as PNG data URL
        const dataUrl = await QRCode.toDataURL(
          `${origin}/l/${location.slug}`,
          {
            width: 512,
            margin: 1,
            color: { dark: "#1a2d21", light: "#ffffff" },
          },
        );

        // Draw QR image centered in cell
        const qrX = x + (cellW - QR_SIZE) / 2;
        const qrY = y + 6;
        const centerX = qrX + QR_SIZE / 2;
        doc.addImage(dataUrl, "PNG", qrX, qrY, QR_SIZE, QR_SIZE);

        // Draw title in a condensed poster-like style (Playbill spirit).
        doc.setFont("times", "bold");
        doc.setFontSize(18);
        doc.setCharSpace(0.45);
        doc.setTextColor(26, 45, 33); // --foreground
        doc.text(location.name.toUpperCase(), centerX, qrY + QR_SIZE + 9, {
          align: "center",
          maxWidth: cellW - 8,
        });
        doc.setCharSpace(0);

        // Draw summary below name in italics.
        const summary = (location.summary ?? "").trim();
        if (summary) {
          doc.setFont(czechFontReady ? "NotoSerif" : "times", "italic");
          doc.setFontSize(9);
          const maxSummaryWidth = cellW - 10;
          const summaryLines = doc.splitTextToSize(summary, maxSummaryWidth).slice(0, 4);
          doc.text(summaryLines, centerX, qrY + QR_SIZE + 16, {
            align: "center",
            maxWidth: maxSummaryWidth,
          });
        }
      }

      doc.save("qr-codes.pdf");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={generating || locations.length === 0}
      className="flex items-center gap-2 rounded-lg border border-[var(--line)] bg-white/60 px-3 py-2 text-sm font-medium transition-colors hover:bg-white/80 disabled:opacity-50"
    >
      {generating ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          Generating…
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
          Stáhnout QR PDF
        </>
      )}
    </button>
  );
}
