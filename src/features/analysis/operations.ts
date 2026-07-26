import { HttpError } from "wasp/server";
import type { GetAnalysisSummary } from "wasp/server/operations";
import { summarizeNetted, type NettedTx } from "./netting";
import type { AnalysisFilterArgs, AnalysisSummary } from "./types";
import type { RelatedType } from "../related/types";

export type { AnalysisFilterArgs, AnalysisSummary } from "./types";

type PrismaWhere = Record<string, unknown>;

function parseIsoDate(raw: string, label: string): Date {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    throw new HttpError(400, `Ungültiges ${label} (YYYY-MM-DD): "${raw}"`);
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function buildWhere(args: AnalysisFilterArgs): PrismaWhere {
  const dateFrom = parseIsoDate(args.dateFrom, "dateFrom");
  const dateTo = parseIsoDate(args.dateTo, "dateTo");
  if (dateFrom > dateTo) {
    throw new HttpError(400, "dateFrom darf nicht nach dateTo liegen.");
  }

  const clauses: PrismaWhere[] = [
    { datum: { gte: dateFrom, lte: dateTo } },
  ];

  if (args.banks && args.banks.length > 0) {
    clauses.push({ bank: { in: args.banks } });
  }
  if (args.konten && args.konten.length > 0) {
    clauses.push({ konto: { in: args.konten } });
  }
  if (args.typ === "income") {
    clauses.push({ betrag: { gt: 0 } });
  } else if (args.typ === "expense") {
    clauses.push({ betrag: { lt: 0 } });
  }

  return clauses.length === 1 ? clauses[0]! : { AND: clauses };
}

/** Period flow summary with related-pair netting. */
export const getAnalysisSummary: GetAnalysisSummary<
  AnalysisFilterArgs,
  AnalysisSummary
> = async (args, context) => {
  if (!args?.dateFrom || !args?.dateTo) {
    throw new HttpError(400, "dateFrom und dateTo sind erforderlich.");
  }

  const base = buildWhere(args);
  const rows = await context.entities.Transaction.findMany({
    where: base,
    select: {
      id: true,
      datum: true,
      betrag: true,
      bank: true,
      relatedTransactionId: true,
      relatedType: true,
    },
  });

  const nettedRows: NettedTx[] = rows.map((r) => ({
    id: r.id,
    datum: r.datum,
    betrag: Number(r.betrag.toString()),
    bank: r.bank,
    relatedTransactionId: r.relatedTransactionId,
    relatedType: r.relatedType as RelatedType | null,
  }));

  const { income, expense, count } = summarizeNetted(nettedRows);
  const net = income - expense;

  return {
    income: income.toFixed(2),
    expense: expense.toFixed(2),
    net: net.toFixed(2),
    count,
    dateFrom: args.dateFrom,
    dateTo: args.dateTo,
  };
};
