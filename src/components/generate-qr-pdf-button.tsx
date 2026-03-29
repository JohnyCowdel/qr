"use client";

import QRCode from "qrcode";
import { useState } from "react";

type Location = {
  slug: string;
  name: string;
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
      const COLS = 3;
      const GAP = 6;

      const cellW = (PAGE_W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
      const QR_SIZE = cellW - 4; // QR image square, leave a little side padding
      const NAME_H = 10; // space reserved for name text below QR
      const cellH = QR_SIZE + NAME_H + 6;

      const doc = new jsPDF({ unit: "mm", format: "a4" });
      const origin = window.location.origin;

      let col = 0;
      let row = 0;
      let pageNum = 0;

      for (let i = 0; i < locations.length; i++) {
        const location = locations[i];

        if (i > 0 && col === 0 && row === 0) {
          doc.addPage();
          pageNum++;
        }

        const x = MARGIN + col * (cellW + GAP);
        const y = MARGIN + row * (cellH + GAP);

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
        doc.addImage(dataUrl, "PNG", qrX, y, QR_SIZE, QR_SIZE);

        // Draw name below
        doc.setFontSize(9);
        doc.setTextColor(26, 45, 33); // --foreground
        doc.text(location.name, x + cellW / 2, y + QR_SIZE + 5, {
          align: "center",
          maxWidth: cellW,
        });

        col++;
        if (col >= COLS) {
          col = 0;
          row++;
          const maxRows = Math.floor((PAGE_H - MARGIN * 2 + GAP) / (cellH + GAP));
          if (row >= maxRows) {
            row = 0;
          }
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
          Download QR PDF
        </>
      )}
    </button>
  );
}
