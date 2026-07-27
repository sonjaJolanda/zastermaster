import type { AnalysisBreakdownRow } from "../analysis/types";
import {
  addChartImage,
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
  expensePieImage?: string | null;
  incomePieImage?: string | null;
  netPieImage?: string | null;
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
  y = addChartImage(doc, y, input.trendImage, "Zeitlicher Trend", 65);
  if (input.showNet) {
    y = addChartImage(
      doc,
      y,
      input.netPieImage,
      "Total nach Kategorie",
      55,
    );
  }
  if (input.showExpense) {
    y = addChartImage(
      doc,
      y,
      input.expensePieImage,
      "Ausgaben nach Kategorie",
      55,
    );
  }
  if (input.showIncome) {
    y = addChartImage(
      doc,
      y,
      input.incomePieImage,
      "Einnahmen nach Kategorie",
      55,
    );
  }

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
