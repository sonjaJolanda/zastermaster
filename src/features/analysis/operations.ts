import { HttpError } from "wasp/server";
import type {
  ExportAnalysisCsv,
  GetAnalysisBreakdown,
  GetAnalysisByCategory,
  GetAnalysisSummary,
  GetAnalysisTimeSeries,
} from "wasp/server/operations";
import { toSemicolonCsv } from "../export/csv";
import type { CsvExportResult } from "../export/types";
import { idsToDropForNetting, summarizeNetted, type NettedTx } from "./netting";
import type {
  AnalysisBreakdown,
  AnalysisBreakdownRow,
  AnalysisByCategory,
  AnalysisCategorySlice,
  AnalysisFilterArgs,
  AnalysisGrouping,
  AnalysisSummary,
  AnalysisTimeSeries,
} from "./types";
import type { RelatedType } from "../related/types";

export type {
  AnalysisBreakdown,
  AnalysisByCategory,
  AnalysisFilterArgs,
  AnalysisSummary,
  AnalysisTimeSeries,
} from "./types";
export type { CsvExportResult } from "../export/types";

type PrismaWhere = Record<string, unknown>;

type LoadedTx = NettedTx & {
  categoryId: number | null;
  subcategoryId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  subcategoryName: string | null;
  subcategoryColor: string | null;
};

const FALLBACK_COLOR = "#78716c";
const FALLBACK_NAME = "Sonstige";

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
    { isBalanceAdjustment: false },
    { isInvestment: false },
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
  if (args.categoryId != null) {
    clauses.push({ categoryId: args.categoryId });
  }
  if (args.subcategoryId != null) {
    clauses.push({ subcategoryId: args.subcategoryId });
  }

  return clauses.length === 1 ? clauses[0]! : { AND: clauses };
}

function requireRange(args: AnalysisFilterArgs | void): AnalysisFilterArgs {
  if (!args?.dateFrom || !args?.dateTo) {
    throw new HttpError(400, "dateFrom und dateTo sind erforderlich.");
  }
  return args;
}

function autoGrouping(dateFrom: Date, dateTo: Date): AnalysisGrouping {
  const days =
    Math.floor((dateTo.getTime() - dateFrom.getTime()) / 86_400_000) + 1;
  // Up to ~1 calendar year: daily points so trends within/between months are visible.
  if (days <= 400) return "day";
  if (days <= 365 * 3) return "month";
  return "year";
}

function enumeratePeriodKeys(
  dateFrom: Date,
  dateTo: Date,
  grouping: AnalysisGrouping,
): string[] {
  const keys: string[] = [];
  if (grouping === "day") {
    const cur = new Date(dateFrom.getTime());
    while (cur.getTime() <= dateTo.getTime()) {
      keys.push(periodKey(cur, "day"));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return keys;
  }
  if (grouping === "month") {
    const cur = new Date(
      Date.UTC(dateFrom.getUTCFullYear(), dateFrom.getUTCMonth(), 1),
    );
    const end = new Date(
      Date.UTC(dateTo.getUTCFullYear(), dateTo.getUTCMonth(), 1),
    );
    while (cur.getTime() <= end.getTime()) {
      keys.push(periodKey(cur, "month"));
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    return keys;
  }
  for (let y = dateFrom.getUTCFullYear(); y <= dateTo.getUTCFullYear(); y++) {
    keys.push(String(y));
  }
  return keys;
}

function periodKey(d: Date, grouping: AnalysisGrouping): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (grouping === "day") return `${y}-${m}-${day}`;
  if (grouping === "month") return `${y}-${m}`;
  return String(y);
}

function periodLabel(key: string, grouping: AnalysisGrouping): string {
  if (grouping === "year") return key;
  if (grouping === "month") {
    const [y, m] = key.split("-");
    const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
    return d.toLocaleDateString("de-DE", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  const [y, m, day] = key.split("-");
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, Number(day)));
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

async function loadNettedRows(
  args: AnalysisFilterArgs,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context: any,
): Promise<{ rows: LoadedTx[]; drop: Set<number> }> {
  const base = buildWhere(args);
  const raw = await context.entities.Transaction.findMany({
    where: base,
    select: {
      id: true,
      datum: true,
      betrag: true,
      bank: true,
      relatedTransactionId: true,
      relatedType: true,
      categoryId: true,
      subcategoryId: true,
      category: { select: { id: true, name: true, color: true } },
      subcategory: { select: { id: true, name: true, color: true } },
    },
  });

  const rows: LoadedTx[] = raw.map(
    (r: {
      id: number;
      datum: Date;
      betrag: { toString(): string };
      bank: string;
      relatedTransactionId: number | null;
      relatedType: RelatedType | null;
      categoryId: number | null;
      subcategoryId: number | null;
      category: { id: number; name: string; color: string } | null;
      subcategory: { id: number; name: string; color: string } | null;
    }) => ({
      id: r.id,
      datum: r.datum,
      betrag: Number(r.betrag.toString()),
      bank: r.bank,
      relatedTransactionId: r.relatedTransactionId,
      relatedType: r.relatedType,
      categoryId: r.categoryId,
      subcategoryId: r.subcategoryId,
      categoryName: r.category?.name ?? null,
      categoryColor: r.category?.color ?? null,
      subcategoryName: r.subcategory?.name ?? null,
      subcategoryColor: r.subcategory?.color ?? null,
    }),
  );

  return { rows, drop: idsToDropForNetting(rows) };
}

function keptRows(rows: LoadedTx[], drop: Set<number>): LoadedTx[] {
  return rows.filter((r) => !drop.has(r.id));
}

function sliceMode(args: AnalysisFilterArgs): "category" | "subcategory" {
  return args.categoryId != null && args.subcategoryId == null
    ? "subcategory"
    : "category";
}

function groupKey(
  row: LoadedTx,
  mode: "category" | "subcategory",
): {
  id: number | null;
  name: string;
  color: string;
} {
  if (mode === "subcategory") {
    return {
      id: row.subcategoryId,
      name: row.subcategoryName ?? FALLBACK_NAME,
      color: row.subcategoryColor ?? row.categoryColor ?? FALLBACK_COLOR,
    };
  }
  return {
    id: row.categoryId,
    name: row.categoryName ?? FALLBACK_NAME,
    color: row.categoryColor ?? FALLBACK_COLOR,
  };
}

type Agg = {
  id: number | null;
  name: string;
  color: string;
  amount: number;
  count: number;
};

function toSlices(aggs: Agg[], total: number): AnalysisCategorySlice[] {
  return aggs
    .sort((a, b) => b.amount - a.amount)
    .map((a) => ({
      id: a.id,
      name: a.name,
      color: a.color,
      amount: a.amount.toFixed(2),
      percent: total > 0 ? Math.round((a.amount / total) * 1000) / 10 : 0,
      count: a.count,
    }));
}

function aggregateSide(
  rows: LoadedTx[],
  mode: "category" | "subcategory",
  side: "income" | "expense",
): AnalysisCategorySlice[] {
  const map = new Map<string, Agg>();
  let total = 0;
  for (const row of rows) {
    const isIncome = row.betrag > 0;
    if (side === "income" && !isIncome) continue;
    if (side === "expense" && !(row.betrag < 0)) continue;
    const amount = Math.abs(row.betrag);
    total += amount;
    const g = groupKey(row, mode);
    const key = g.id == null ? `n:${g.name}` : `i:${g.id}`;
    const cur = map.get(key);
    if (cur) {
      cur.amount += amount;
      cur.count += 1;
    } else {
      map.set(key, { ...g, amount, count: 1 });
    }
  }
  return toSlices([...map.values()], total);
}

function buildBreakdown(
  rows: LoadedTx[],
  side: "income" | "expense",
  mode: "category" | "subcategory",
): AnalysisBreakdownRow[] {
  type ChildAgg = {
    id: number | null;
    name: string;
    color: string;
    amount: number;
    count: number;
  };
  type ParentAgg = Agg & { children: Map<string, ChildAgg> };

  const parents = new Map<string, ParentAgg>();
  let total = 0;

  for (const row of rows) {
    const isIncome = row.betrag > 0;
    if (side === "income" && !isIncome) continue;
    if (side === "expense" && !(row.betrag < 0)) continue;
    const amount = Math.abs(row.betrag);
    total += amount;

    const parent = groupKey(row, mode);
    const pKey = parent.id == null ? `n:${parent.name}` : `i:${parent.id}`;
    let p = parents.get(pKey);
    if (!p) {
      p = { ...parent, amount: 0, count: 0, children: new Map() };
      parents.set(pKey, p);
    }
    p.amount += amount;
    p.count += 1;

    if (mode === "category") {
      const childId = row.subcategoryId;
      const childName = row.subcategoryName ?? FALLBACK_NAME;
      const childColor =
        row.subcategoryColor ?? row.categoryColor ?? FALLBACK_COLOR;
      const cKey = childId == null ? `n:${childName}` : `i:${childId}`;
      const c = p.children.get(cKey);
      if (c) {
        c.amount += amount;
        c.count += 1;
      } else {
        p.children.set(cKey, {
          id: childId,
          name: childName,
          color: childColor,
          amount,
          count: 1,
        });
      }
    }
  }

  return [...parents.values()]
    .sort((a, b) => b.amount - a.amount)
    .map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      amount: p.amount.toFixed(2),
      percent: total > 0 ? Math.round((p.amount / total) * 1000) / 10 : 0,
      count: p.count,
      children: [...p.children.values()]
        .sort((a, b) => b.amount - a.amount)
        .map((c) => ({
          id: c.id,
          name: c.name,
          color: c.color,
          amount: c.amount.toFixed(2),
          percent:
            p.amount > 0 ? Math.round((c.amount / p.amount) * 1000) / 10 : 0,
          count: c.count,
        })),
    }));
}

/** Period flow summary with related-pair netting. */
export const getAnalysisSummary: GetAnalysisSummary<
  AnalysisFilterArgs,
  AnalysisSummary
> = async (args, context) => {
  const filter = requireRange(args);
  const { rows } = await loadNettedRows(filter, context);
  const { income, expense, count } = summarizeNetted(rows);
  const net = income - expense;

  return {
    income: income.toFixed(2),
    expense: expense.toFixed(2),
    net: net.toFixed(2),
    count,
    dateFrom: filter.dateFrom,
    dateTo: filter.dateTo,
  };
};

export const getAnalysisTimeSeries: GetAnalysisTimeSeries<
  AnalysisFilterArgs,
  AnalysisTimeSeries
> = async (args, context) => {
  const filter = requireRange(args);
  const dateFrom = parseIsoDate(filter.dateFrom, "dateFrom");
  const dateTo = parseIsoDate(filter.dateTo, "dateTo");
  const grouping = filter.grouping ?? autoGrouping(dateFrom, dateTo);
  const { rows, drop } = await loadNettedRows(filter, context);

  const buckets = new Map<string, { income: number; expense: number }>();
  for (const key of enumeratePeriodKeys(dateFrom, dateTo, grouping)) {
    buckets.set(key, { income: 0, expense: 0 });
  }
  for (const row of rows) {
    if (drop.has(row.id)) continue;
    const key = periodKey(row.datum, grouping);
    let b = buckets.get(key);
    if (!b) {
      b = { income: 0, expense: 0 };
      buckets.set(key, b);
    }
    if (row.betrag > 0) b.income += row.betrag;
    else if (row.betrag < 0) b.expense += Math.abs(row.betrag);
  }

  const points = [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, v]) => ({
      period,
      label: periodLabel(period, grouping),
      income: v.income.toFixed(2),
      expense: v.expense.toFixed(2),
    }));

  return { grouping, points };
};

export const getAnalysisByCategory: GetAnalysisByCategory<
  AnalysisFilterArgs,
  AnalysisByCategory
> = async (args, context) => {
  const filter = requireRange(args);
  const mode = sliceMode(filter);
  const { rows, drop } = await loadNettedRows(filter, context);
  const kept = keptRows(rows, drop);

  return {
    mode,
    expenses: aggregateSide(kept, mode, "expense"),
    income: aggregateSide(kept, mode, "income"),
  };
};

export const getAnalysisBreakdown: GetAnalysisBreakdown<
  AnalysisFilterArgs,
  AnalysisBreakdown
> = async (args, context) => {
  const filter = requireRange(args);
  const mode = sliceMode(filter);
  const { rows, drop } = await loadNettedRows(filter, context);
  const kept = keptRows(rows, drop);

  return {
    mode,
    expenses: buildBreakdown(kept, "expense", mode),
    income: buildBreakdown(kept, "income", mode),
  };
};

/** Summary + category breakdown CSV for current Analyse filters (netted). */
export const exportAnalysisCsv: ExportAnalysisCsv<
  AnalysisFilterArgs,
  CsvExportResult
> = async (args, context) => {
  const filter = requireRange(args);
  const mode = sliceMode(filter);
  const { rows, drop } = await loadNettedRows(filter, context);
  const kept = keptRows(rows, drop);
  const { income, expense, count } = summarizeNetted(rows);
  const net = income - expense;
  const expenses = buildBreakdown(kept, "expense", mode);
  const incomes = buildBreakdown(kept, "income", mode);

  const outRows: (string | number | null)[][] = [
    ["Zusammenfassung", "Von", filter.dateFrom, "", ""],
    ["Zusammenfassung", "Bis", filter.dateTo, "", ""],
    [
      "Zusammenfassung",
      "Einnahmen",
      income.toFixed(2).replace(".", ","),
      "",
      "",
    ],
    [
      "Zusammenfassung",
      "Ausgaben",
      expense.toFixed(2).replace(".", ","),
      "",
      "",
    ],
    ["Zusammenfassung", "Netto", net.toFixed(2).replace(".", ","), "", ""],
    ["Zusammenfassung", "Buchungen", count, "", ""],
  ];

  for (const row of expenses) {
    outRows.push([
      "Ausgaben",
      row.name,
      row.amount.replace(".", ","),
      row.percent,
      row.count,
    ]);
    for (const child of row.children) {
      outRows.push([
        "Ausgaben-Unter",
        child.name,
        child.amount.replace(".", ","),
        child.percent,
        child.count,
      ]);
    }
  }
  for (const row of incomes) {
    outRows.push([
      "Einnahmen",
      row.name,
      row.amount.replace(".", ","),
      row.percent,
      row.count,
    ]);
    for (const child of row.children) {
      outRows.push([
        "Einnahmen-Unter",
        child.name,
        child.amount.replace(".", ","),
        child.percent,
        child.count,
      ]);
    }
  }

  const csv = toSemicolonCsv(
    ["Abschnitt", "Name", "Betrag", "Anteil_%", "Buchungen"],
    outRows,
  );
  const stamp = `${filter.dateFrom}_${filter.dateTo}`;
  return {
    csv,
    rowCount: outRows.length,
    fileName: `zaster-analyse-${stamp}.csv`,
  };
};
