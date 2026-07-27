import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { APP_VERSION } from "../../version";
import { PDF_TX_MAX_ROWS } from "./pdfConstants";

export { PDF_TX_MAX_ROWS };

const LOGO_PATH = "/design/Zaster_Master_Logo.svg";

export type ReportMetric = { label: string; value: string };

export type ReportPdfOptions = {
  title: string;
  fileStem: "transaktionen" | "analyse";
  metrics: ReportMetric[];
  filterLines: string[];
  notes?: string[];
};

function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function reportFileName(
  stem: "transaktionen" | "analyse",
): string {
  return `zastermaster-${stem}-${todayIsoDate()}.pdf`;
}

export function formatCreatedAtDe(d = new Date()): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Rasterize SVG logo for jsPDF (needs PNG/JPEG). */
export async function loadLogoPngDataUrl(): Promise<string | null> {
  try {
    const img = new Image();
    img.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Logo load failed"));
      img.src = LOGO_PATH;
    });
    const maxW = 320;
    const ratio =
      img.naturalWidth > 0 ? img.naturalHeight / img.naturalWidth : 1;
    const w = maxW;
    const h = Math.max(1, Math.round(maxW * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export function downloadPdf(fileName: string, doc: jsPDF): void {
  doc.save(fileName);
}

type DocWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number };
};

function applyHeaderFooter(
  doc: jsPDF,
  opts: {
    title: string;
    createdAt: string;
    logoDataUrl: string | null;
  },
): void {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    if (opts.logoDataUrl) {
      doc.addImage(opts.logoDataUrl, "PNG", 14, 8, 14, 14);
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(28, 25, 23);
    doc.text(`Zaster Master — ${opts.title}`, opts.logoDataUrl ? 32 : 14, 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(87, 83, 78);
    doc.text(`Erstellt am: ${opts.createdAt}`, pageW - 14, 12, {
      align: "right",
    });
    doc.text(`Zaster Master v${APP_VERSION}`, pageW - 14, 17, {
      align: "right",
    });

    doc.setDrawColor(200, 190, 180);
    doc.line(14, 24, pageW - 14, 24);

    doc.setFontSize(8);
    doc.text(`Seite ${i} / ${pageCount}`, pageW / 2, pageH - 8, {
      align: "center",
    });
  }
}

/**
 * Start a report PDF: logo header band reserved; returns y after intro block.
 */
export async function createReportDoc(
  opts: ReportPdfOptions,
): Promise<{ doc: DocWithAutoTable; startY: number; fileName: string }> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" }) as DocWithAutoTable;
  const logoDataUrl = await loadLogoPngDataUrl();
  const createdAt = formatCreatedAtDe();
  const fileName = reportFileName(opts.fileStem);

  // Reserve header space; real header drawn at end so page count is known.
  let y = 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(28, 25, 23);
  doc.text("Kennzahlen", 14, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const metricLine = opts.metrics
    .map((m) => `${m.label}: ${m.value}`)
    .join("   ·   ");
  const metricLines = doc.splitTextToSize(metricLine, 182);
  doc.text(metricLines, 14, y);
  y += metricLines.length * 4.5 + 3;

  if (opts.filterLines.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Filter", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const line of opts.filterLines) {
      const wrapped = doc.splitTextToSize(line, 182);
      doc.text(wrapped, 14, y);
      y += wrapped.length * 4.2;
    }
    y += 3;
  }

  if (opts.notes && opts.notes.length > 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(120, 53, 15);
    for (const note of opts.notes) {
      const wrapped = doc.splitTextToSize(note, 182);
      doc.text(wrapped, 14, y);
      y += wrapped.length * 4;
    }
    doc.setTextColor(28, 25, 23);
    y += 2;
  }

  // Stash for finalize
  (doc as unknown as { __zmHeader?: typeof logoDataUrl }).__zmHeader =
    logoDataUrl;
  (doc as unknown as { __zmCreatedAt?: string }).__zmCreatedAt = createdAt;
  (doc as unknown as { __zmTitle?: string }).__zmTitle = opts.title;

  return { doc, startY: y, fileName };
}

export function finalizeReportDoc(doc: DocWithAutoTable, title: string): void {
  const logoDataUrl =
    (doc as unknown as { __zmHeader?: string | null }).__zmHeader ?? null;
  const createdAt =
    (doc as unknown as { __zmCreatedAt?: string }).__zmCreatedAt ??
    formatCreatedAtDe();
  applyHeaderFooter(doc, { title, createdAt, logoDataUrl });
}

export function addSimpleTable(
  doc: DocWithAutoTable,
  startY: number,
  head: string[],
  body: string[][],
  title?: string,
): number {
  let y = startY;
  if (title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(28, 25, 23);
    doc.text(title, 14, y);
    y += 3;
  }

  autoTable(doc, {
    startY: y,
    head: [head],
    body,
    styles: {
      fontSize: 7,
      cellPadding: 1.2,
      overflow: "linebreak",
      textColor: [28, 25, 23],
    },
    headStyles: {
      fillColor: [28, 25, 23],
      textColor: 255,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [252, 248, 243] },
    margin: { left: 14, right: 14, top: 28, bottom: 16 },
  });

  return (doc.lastAutoTable?.finalY ?? y) + 8;
}

export function addChartImage(
  doc: DocWithAutoTable,
  startY: number,
  dataUrl: string | null | undefined,
  title: string,
  maxHeightMm = 70,
  aspectRatio?: number | null,
): number {
  let y = startY;
  if (!dataUrl) return y;

  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - 28;
  let drawW = maxW;
  let drawH = maxHeightMm;
  if (aspectRatio && aspectRatio > 0) {
    drawH = drawW / aspectRatio;
    if (drawH > maxHeightMm) {
      drawH = maxHeightMm;
      drawW = drawH * aspectRatio;
    }
  }

  const pageH = doc.internal.pageSize.getHeight();
  if (y + drawH + 20 > pageH - 16) {
    doc.addPage();
    y = 30;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(28, 25, 23);
  doc.text(title, 14, y);
  y += 4;

  const x = 14 + (maxW - drawW) / 2;
  doc.addImage(dataUrl, "PNG", x, y, drawW, drawH, undefined, "FAST");
  return y + drawH + 8;
}

export function addChartImageRow(
  doc: DocWithAutoTable,
  startY: number,
  charts: {
    title: string;
    dataUrl: string | null | undefined;
    aspectRatio?: number | null;
  }[],
  /** Cap each chart image so PDF pies stay ≤ on-screen size (~132–220 CSS px). */
  maxImageMm = 36,
): number {
  const visibleCharts = charts.filter((chart) => chart.dataUrl);
  let y = startY;
  if (visibleCharts.length === 0) return y;

  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const gap = 4;
  const usableW = pageW - 28;
  const colW =
    (usableW - gap * Math.max(visibleCharts.length - 1, 0)) /
    visibleCharts.length;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(28, 25, 23);

  const wrappedTitles = visibleCharts.map((chart) =>
    doc.splitTextToSize(chart.title, colW),
  );
  const titleHeight =
    Math.max(...wrappedTitles.map((lines) => lines.length), 1) * 4.2;

  const sized = visibleCharts.map((chart) => {
    const ratio =
      chart.aspectRatio && chart.aspectRatio > 0 ? chart.aspectRatio : 1;
    // Fit inside the smaller of maxImageMm and the column, preserving ratio.
    const maxSide = Math.min(maxImageMm, colW);
    let drawW = maxSide;
    let drawH = drawW / ratio;
    if (drawH > maxSide) {
      drawH = maxSide;
      drawW = drawH * ratio;
    }
    return { drawW, drawH };
  });
  const rowImageH = Math.max(...sized.map((s) => s.drawH), 0);

  if (y + titleHeight + rowImageH + 10 > pageH - 16) {
    doc.addPage();
    y = 30;
  }

  visibleCharts.forEach((chart, index) => {
    const colX = 14 + index * (colW + gap);
    const titleLines = wrappedTitles[index] ?? [chart.title];
    doc.text(titleLines, colX + colW / 2, y, { align: "center" });
    const { drawW, drawH } = sized[index]!;
    const imgX = colX + (colW - drawW) / 2;
    doc.addImage(
      chart.dataUrl!,
      "PNG",
      imgX,
      y + titleHeight,
      drawW,
      drawH,
      undefined,
      "FAST",
    );
  });

  return y + titleHeight + rowImageH + 8;
}

export { autoTable };
