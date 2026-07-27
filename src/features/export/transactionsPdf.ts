import {
  addSimpleTable,
  createReportDoc,
  downloadPdf,
  finalizeReportDoc,
  PDF_TX_MAX_ROWS,
  type ReportMetric,
} from "./pdf";
import type { TransactionsPdfExportResult } from "./types";

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const dateDe = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

export type TransactionsPdfInput = {
  metrics: ReportMetric[];
  filterLines: string[];
  data: TransactionsPdfExportResult;
};

export async function buildAndDownloadTransactionsPdf(
  input: TransactionsPdfInput,
): Promise<{ truncated: boolean; totalCount: number }> {
  const notes: string[] = [];
  if (input.data.truncated) {
    notes.push(
      `Hinweis: Nur die ersten ${PDF_TX_MAX_ROWS.toLocaleString("de-DE")} von ${input.data.totalCount.toLocaleString("de-DE")} Buchungen. Für den vollständigen Export bitte CSV nutzen.`,
    );
  }

  const { doc, startY, fileName } = await createReportDoc({
    title: "Transaktionen",
    fileStem: "transaktionen",
    metrics: input.metrics,
    filterLines: input.filterLines,
    notes,
  });

  const body = input.data.rows.map((r) => [
    dateDe.format(new Date(r.datum)),
    r.bank,
    r.konto,
    eur.format(Number(r.betrag)),
    r.verwendungszweck || "—",
    r.kategorie,
  ]);

  addSimpleTable(
    doc,
    startY,
    ["Datum", "Bank", "Konto", "Betrag", "Verwendungszweck", "Kategorie"],
    body,
    "Buchungen",
  );

  finalizeReportDoc(doc, "Transaktionen");
  downloadPdf(fileName, doc);
  return {
    truncated: input.data.truncated,
    totalCount: input.data.totalCount,
  };
}
