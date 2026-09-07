import { HttpError } from "wasp/server";
import type {
  ExportTransactionsCsv,
  ExportTransactionsForPdf,
  GetTransactionFilterOptions,
  GetTransactionNav,
  GetTransactions,
  GetTransactionsSummary,
} from "wasp/server/operations";
import { toSemicolonCsv } from "../export/csv";
import { PDF_TX_MAX_ROWS } from "../export/pdfConstants";
import type {
  CsvExportResult,
  TransactionsPdfExportResult,
} from "../export/types";
import {
  summarizeNetted,
  type NettedTx,
} from "../analysis/netting";
import { toTransactionsSummary } from "./summary";
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
export type { TransactionsPdfExportResult } from "../export/types";
export { computeTransactionsSummary, toTransactionsSummary } from "./summary";

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
  if (args.categoryId != null) {
    clauses.push({ categoryId: args.categoryId });
  }
  if (args.subcategoryId != null) {
    clauses.push({ subcategoryId: args.subcategoryId });
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

function mapRow(
  row: {
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
    relatedGroupId: string | null;
    relatedType: TransactionListItem["relatedType"];
    isInvestment: boolean;
    category: { id: number; name: string; color: string } | null;
    subcategory: { id: number; name: string } | null;
  },
  relatedIds: number[] = [],
): TransactionListItem {
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
    relatedGroupId: row.relatedGroupId,
    relatedIds,
    relatedType: row.relatedType,
    isInvestment: row.isInvestment,
  };
}

async function relatedIdsByTxId(
  rows: { id: number; relatedGroupId: string | null; relatedTransactionId: number | null }[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  entities: { Transaction: { findMany: (args: any) => Promise<{ id: number; relatedGroupId: string | null }[]> } },
): Promise<Map<number, number[]>> {
  const result = new Map<number, number[]>();
  const groupIds = [
    ...new Set(
      rows
        .map((r) => r.relatedGroupId)
        .filter((g): g is string => g != null && g.length > 0),
    ),
  ];

  if (groupIds.length > 0) {
    const members = await entities.Transaction.findMany({
      where: { relatedGroupId: { in: groupIds } },
      select: { id: true, relatedGroupId: true },
    });
    const byGroup = new Map<string, number[]>();
    for (const m of members) {
      if (!m.relatedGroupId) continue;
      const list = byGroup.get(m.relatedGroupId) ?? [];
      list.push(m.id);
      byGroup.set(m.relatedGroupId, list);
    }
    for (const row of rows) {
      if (!row.relatedGroupId) continue;
      const ids = byGroup.get(row.relatedGroupId) ?? [];
      result.set(
        row.id,
        ids.filter((id) => id !== row.id).sort((a, b) => a - b),
      );
    }
  }

  for (const row of rows) {
    if (result.has(row.id)) continue;
    if (row.relatedTransactionId != null) {
      result.set(row.id, [row.relatedTransactionId]);
    } else {
      result.set(row.id, []);
    }
  }

  return result;
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

  const relatedMap = await relatedIdsByTxId(rows, context.entities);

  return {
    items: rows.map((row) => mapRow(row, relatedMap.get(row.id) ?? [])),
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

  const rows = await context.entities.Transaction.findMany({
    where: base,
    select: {
      id: true,
      datum: true,
      betrag: true,
      bank: true,
      relatedTransactionId: true,
      relatedType: true,
      relatedGroupId: true,
    },
  });

  const netted: NettedTx[] = rows.map((r) => ({
    id: r.id,
    datum: r.datum,
    betrag: Number(r.betrag.toString()),
    bank: r.bank,
    relatedTransactionId: r.relatedTransactionId,
    relatedType: r.relatedType,
    relatedGroupId: r.relatedGroupId,
  }));

  const { income, expense, count } = summarizeNetted(netted);
  // summarizeNetted returns expense as positive magnitude.
  return toTransactionsSummary(income, -expense, count);
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

  const relatedMap = await relatedIdsByTxId([row], context.entities);
  const item = mapRow(row, relatedMap.get(row.id) ?? []);
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
    categoryId: args.categoryId,
    subcategoryId: args.subcategoryId,
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

/** Filtered TX rows for PDF report (cap 2k; truncated flag if more). */
export const exportTransactionsForPdf: ExportTransactionsForPdf<
  TransactionFilterArgs | void,
  TransactionsPdfExportResult
> = async (args, context) => {
  const where = buildWhere(args);
  const totalCount = await context.entities.Transaction.count({ where });
  const rows = await context.entities.Transaction.findMany({
    where,
    orderBy: [{ datum: "desc" }, { id: "desc" }],
    take: PDF_TX_MAX_ROWS,
    include: {
      category: { select: { name: true } },
      subcategory: { select: { name: true } },
    },
  });

  return {
    totalCount,
    truncated: totalCount > PDF_TX_MAX_ROWS,
    rows: rows.map((r) => {
      const cat =
        r.category?.name && r.subcategory?.name
          ? `${r.category.name} › ${r.subcategory.name}`
          : (r.category?.name ?? "—");
      return {
        datum: r.datum.toISOString().slice(0, 10),
        bank: r.bank,
        konto: r.konto,
        betrag: r.betrag.toString(),
        verwendungszweck: r.verwendungszweck,
        kategorie: cat,
      };
    }),
  };
};
