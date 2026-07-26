import { HttpError } from "wasp/server";
import type {
  ExportTransactionsCsv,
  GetTransactionFilterOptions,
  GetTransactionNav,
  GetTransactions,
  GetTransactionsSummary,
} from "wasp/server/operations";
import { toSemicolonCsv } from "../export/csv";
import type { CsvExportResult } from "../export/types";
import type {
  TransactionFilterArgs,
  TransactionFilterOptions,
  TransactionListItem,
  TransactionNavArgs,
  TransactionNavResult,
  TransactionsPageResult,
  TransactionsSummary,
} from "./types";
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "./types";

export type {
  CsvExportResult,
  TransactionFilterArgs,
  TransactionListItem,
  TransactionNavArgs,
  TransactionNavResult,
  TransactionsPageResult,
  TransactionsSummary,
} from "./types";

const EXPORT_MAX_ROWS = 100_000;

type PrismaWhere = Record<string, unknown>;

function normalizePageSize(raw: number | undefined): number {
  const n = raw ?? DEFAULT_PAGE_SIZE;
  if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return n;
  return DEFAULT_PAGE_SIZE;
}

function parseOptionalIsoDate(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null;
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function buildWhere(args: TransactionFilterArgs | void): PrismaWhere {
  if (!args || typeof args !== "object") {
    return { isBalanceAdjustment: false };
  }

  const clauses: PrismaWhere[] = [];

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
  if (args.categorySource && args.categorySource !== "all") {
    clauses.push({ categorySource: args.categorySource });
  }
  if (!args.includeBalanceAdjustments) {
    clauses.push({ isBalanceAdjustment: false });
  }

  const dateFrom = parseOptionalIsoDate(args.dateFrom);
  const dateTo = parseOptionalIsoDate(args.dateTo);
  if (dateFrom || dateTo) {
    const datum: { gte?: Date; lte?: Date } = {};
    if (dateFrom) datum.gte = dateFrom;
    if (dateTo) datum.lte = dateTo;
    clauses.push({ datum });
  }

  const search = args.search?.trim();
  if (search) {
    clauses.push({
      OR: [
        { verwendungszweck: { contains: search, mode: "insensitive" } },
        { sender: { contains: search, mode: "insensitive" } },
        { empfaenger: { contains: search, mode: "insensitive" } },
      ],
    });
  }

  if (clauses.length === 0) return {};
  if (clauses.length === 1) return clauses[0]!;
  return { AND: clauses };
}

function mapRow(row: {
  id: number;
  datum: Date;
  betrag: { toString(): string };
  sender: string;
  empfaenger: string;
  verwendungszweck: string;
  iban: string;
  kundenreferenz: string;
  bank: string;
  konto: string;
  categoryId: number | null;
  subcategoryId: number | null;
  confidenceScore: number;
  categorySource: TransactionListItem["categorySource"];
  relatedTransactionId: number | null;
  relatedType: TransactionListItem["relatedType"];
  category: { id: number; name: string; color: string } | null;
  subcategory: { id: number; name: string } | null;
}): TransactionListItem {
  return {
    id: row.id,
    datum: row.datum.toISOString().slice(0, 10),
    betrag: row.betrag.toString(),
    sender: row.sender,
    empfaenger: row.empfaenger,
    verwendungszweck: row.verwendungszweck,
    iban: row.iban,
    kundenreferenz: row.kundenreferenz,
    bank: row.bank,
    konto: row.konto,
    categoryId: row.categoryId,
    subcategoryId: row.subcategoryId,
    categoryName: row.category?.name ?? null,
    subcategoryName: row.subcategory?.name ?? null,
    categoryColor: row.category?.color ?? null,
    confidenceScore: row.confidenceScore,
    categorySource: row.categorySource,
    relatedTransactionId: row.relatedTransactionId,
    relatedType: row.relatedType,
  };
}

export const getTransactions: GetTransactions<
  TransactionFilterArgs | void,
  TransactionsPageResult
> = async (args, context) => {
  const pageSize = normalizePageSize(
    args && typeof args === "object" ? args.pageSize : undefined,
  );
  const page = Math.max(
    1,
    args && typeof args === "object" && args.page ? args.page : 1,
  );
  const where = buildWhere(args);

  const totalCount = await context.entities.Transaction.count({ where });
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, pageCount);

  const rows = await context.entities.Transaction.findMany({
    where,
    orderBy: [{ datum: "desc" }, { id: "desc" }],
    skip: (safePage - 1) * pageSize,
    take: pageSize,
    include: {
      category: { select: { id: true, name: true, color: true } },
      subcategory: { select: { id: true, name: true } },
    },
  });

  return {
    items: rows.map(mapRow),
    totalCount,
    page: safePage,
    pageSize,
    pageCount,
  };
};

export const getTransactionsSummary: GetTransactionsSummary<
  TransactionFilterArgs | void,
  TransactionsSummary
> = async (args, context) => {
  const base = buildWhere(args);

  const incomeWhere =
    Object.keys(base).length === 0
      ? { betrag: { gt: 0 } }
      : { AND: [base, { betrag: { gt: 0 } }] };
  const expenseWhere =
    Object.keys(base).length === 0
      ? { betrag: { lt: 0 } }
      : { AND: [base, { betrag: { lt: 0 } }] };

  const [count, incomeAgg, expenseAgg] = await Promise.all([
    context.entities.Transaction.count({ where: base }),
    context.entities.Transaction.aggregate({
      where: incomeWhere,
      _sum: { betrag: true },
    }),
    context.entities.Transaction.aggregate({
      where: expenseWhere,
      _sum: { betrag: true },
    }),
  ]);

  const income = Number(incomeAgg._sum.betrag?.toString() ?? 0);
  const expenseRaw = Number(expenseAgg._sum.betrag?.toString() ?? 0);
  const expense = Math.abs(expenseRaw);
  const net = income - expense;

  return {
    income: income.toFixed(2),
    expense: expense.toFixed(2),
    net: net.toFixed(2),
    count,
  };
};

export const getTransactionFilterOptions: GetTransactionFilterOptions<
  void,
  TransactionFilterOptions
> = async (_args, context) => {
  const rows = await context.entities.Transaction.findMany({
    distinct: ["bank", "konto"],
    select: { bank: true, konto: true },
    orderBy: [{ bank: "asc" }, { konto: "asc" }],
  });

  const banks = [...new Set(rows.map((r) => r.bank))].sort();
  const konten = [...new Set(rows.map((r) => r.konto))].sort();
  return { banks, konten };
};

/** Resolve a transaction + its list page under the current filters (for related-link nav). */
export const getTransactionNav: GetTransactionNav<
  TransactionNavArgs,
  TransactionNavResult | null
> = async (args, context) => {
  if (!args?.id) return null;

  const row = await context.entities.Transaction.findUnique({
    where: { id: args.id },
    include: {
      category: { select: { id: true, name: true, color: true } },
      subcategory: { select: { id: true, name: true } },
    },
  });
  if (!row) return null;

  const item = mapRow(row);
  const pageSize = normalizePageSize(args.pageSize);
  const filterWhere = buildWhere({
    banks: args.banks,
    konten: args.konten,
    typ: args.typ,
    categorySource: args.categorySource,
    includeBalanceAdjustments: args.includeBalanceAdjustments,
    dateFrom: args.dateFrom,
    dateTo: args.dateTo,
    search: args.search,
  });

  const inFilterCount = await context.entities.Transaction.count({
    where:
      Object.keys(filterWhere).length === 0
        ? { id: row.id }
        : { AND: [filterWhere, { id: row.id }] },
  });

  if (inFilterCount === 0) {
    return { item, page: null };
  }

  // Same order as getTransactions: datum desc, id desc → rows listed before this one.
  const beforeWhere: PrismaWhere = {
    OR: [
      { datum: { gt: row.datum } },
      { AND: [{ datum: row.datum }, { id: { gt: row.id } }] },
    ],
  };
  const beforeCount = await context.entities.Transaction.count({
    where:
      Object.keys(filterWhere).length === 0
        ? beforeWhere
        : { AND: [filterWhere, beforeWhere] },
  });

  const page = Math.floor(beforeCount / pageSize) + 1;
  return { item, page };
};

/** Full filtered set as German Excel-friendly semicolon CSV (cap 100k). */
export const exportTransactionsCsv: ExportTransactionsCsv<
  TransactionFilterArgs | void,
  CsvExportResult
> = async (args, context) => {
  const where = buildWhere(args);
  const totalCount = await context.entities.Transaction.count({ where });
  if (totalCount > EXPORT_MAX_ROWS) {
    throw new HttpError(
      400,
      `Export zu groß (${totalCount.toLocaleString("de-DE")} Zeilen, max. ${EXPORT_MAX_ROWS.toLocaleString("de-DE")}). Bitte Filter enger setzen.`,
    );
  }

  const rows = await context.entities.Transaction.findMany({
    where,
    orderBy: [{ datum: "desc" }, { id: "desc" }],
    take: EXPORT_MAX_ROWS,
    include: {
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
    },
  });

  const csv = toSemicolonCsv(
    [
      "Id",
      "Datum",
      "Bank",
      "Konto",
      "Betrag",
      "Sender",
      "Empfaenger",
      "Verwendungszweck",
      "IBAN",
      "Kundenreferenz",
      "Kategorie",
      "Unterkategorie",
      "Konfidenz",
      "RelatedId",
      "RelatedType",
    ],
    rows.map((r) => [
      r.id,
      r.datum.toISOString().slice(0, 10),
      r.bank,
      r.konto,
      r.betrag.toString().replace(".", ","),
      r.sender,
      r.empfaenger,
      r.verwendungszweck,
      r.iban,
      r.kundenreferenz,
      r.category?.name ?? "",
      r.subcategory?.name ?? "",
      r.categorySource,
      r.relatedTransactionId,
      r.relatedType,
    ]),
  );

  const stamp = new Date().toISOString().slice(0, 10);
  return {
    csv,
    rowCount: rows.length,
    fileName: `zaster-transaktionen-${stamp}.csv`,
  };
};
