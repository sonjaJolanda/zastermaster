import type { AnalysisBreakdownRow } from "../analysis/types";
import {
  addChartImage,
  addChartImageRow,
  addSimpleTable,
  createReportDoc,
  downloadPdf,
  finalizeReportDoc,
  type ReportMetric,
} from "./pdf";

export type AnalysisPdfInput = {
  metrics: ReportMetric[];
  filterLines: string[];
  trendImage?: string | null;
  trendAspectRatio?: number | null;
  monthBarImage?: string | null;
  monthBarAspectRatio?: number | null;
  expensePieImage?: string | null;
  incomePieImage?: string | null;
  netPieImage?: string | null;
  expensePieAspectRatio?: number | null;
  incomePieAspectRatio?: number | null;
  netPieAspectRatio?: number | null;
  expenseBreakdown: AnalysisBreakdownRow[];
  incomeBreakdown: AnalysisBreakdownRow[];
  netBreakdown?: AnalysisBreakdownRow[];
  showExpense: boolean;
  showIncome: boolean;
  showNet?: boolean;
};

function flattenBreakdown(rows: AnalysisBreakdownRow[]): string[][] {
  const out: string[][] = [];
  for (const row of rows) {
    out.push([
      row.name,
      Number(row.amount).toLocaleString("de-DE", {
        style: "currency",
        currency: "EUR",
      }),
      `${row.percent} %`,
      String(row.count),
    ]);
    for (const child of row.children) {
      out.push([
        `  ${child.name}`,
        Number(child.amount).toLocaleString("de-DE", {
          style: "currency",
          currency: "EUR",
        }),
        `${child.percent} %`,
        String(child.count),
      ]);
    }
  }
  return out;
}

export async function buildAndDownloadAnalysisPdf(
  input: AnalysisPdfInput,
): Promise<void> {
  const { doc, startY, fileName } = await createReportDoc({
    title: "Analyse",
    fileStem: "analyse",
    metrics: input.metrics,
    filterLines: input.filterLines,
  });

  let y = startY;
  y = addChartImage(
    doc,
    y,
    input.trendImage,
    "Zeitlicher Trend",
    65,
    input.trendAspectRatio,
  );
  y = addChartImage(
    doc,
    y,
    input.monthBarImage,
    "Vergleich pro Monat",
    65,
    input.monthBarAspectRatio,
  );
  const pieCharts: {
    title: string;
    dataUrl: string | null | undefined;
    aspectRatio?: number | null;
  }[] = [];
  if (input.showNet) {
    pieCharts.push({
      title: "Total nach Kategorie",
      dataUrl: input.netPieImage,
      aspectRatio: input.netPieAspectRatio,
    });
  }
  if (input.showExpense) {
    pieCharts.push({
      title: "Ausgaben nach Kategorie",
      dataUrl: input.expensePieImage,
      aspectRatio: input.expensePieAspectRatio,
    });
  }
  if (input.showIncome) {
    pieCharts.push({
      title: "Einnahmen nach Kategorie",
      dataUrl: input.incomePieImage,
      aspectRatio: input.incomePieAspectRatio,
    });
  }
  // On-screen: ~132px triple / ~220px single ≈ 35–58mm — never larger in PDF.
  const pieMaxMm =
    pieCharts.length >= 3 ? 36 : pieCharts.length === 2 ? 48 : 58;
  y = addChartImageRow(doc, y, pieCharts, pieMaxMm);

  const head = ["Name", "Betrag", "Anteil", "Buchungen"];
  if (input.showNet) {
    y = addSimpleTable(
      doc,
      y,
      head,
      flattenBreakdown(input.netBreakdown ?? []),
      "Total-Aufschlüsselung",
    );
  }
  if (input.showExpense) {
    y = addSimpleTable(
      doc,
      y,
      head,
      flattenBreakdown(input.expenseBreakdown),
      "Ausgaben-Aufschlüsselung",
    );
  }
  if (input.showIncome) {
    addSimpleTable(
      doc,
      y,
      head,
      flattenBreakdown(input.incomeBreakdown),
      "Einnahmen-Aufschlüsselung",
    );
  }

  finalizeReportDoc(doc, "Analyse");
  downloadPdf(fileName, doc);
}
