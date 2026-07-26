import type {
  GetTransactionFilterOptions,
  GetTransactionNav,
  GetTransactions,
  GetTransactionsSummary,
} from "wasp/server/operations";
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
  TransactionFilterArgs,
  TransactionListItem,
  TransactionNavArgs,
  TransactionNavResult,
  TransactionsPageResult,
  TransactionsSummary,
} from "./types";

type PrismaWhere = Record<string, unknown>;

function normalizePageSize(raw: number | undefined): number {
  const n = raw ?? DEFAULT_PAGE_SIZE;
  if ((PAGE_SIZE_OPTIONS as readonly number[]).includes(n)) return n;
  return DEFAULT_PAGE_SIZE;
}

function buildWhere(args: TransactionFilterArgs | void): PrismaWhere {
  if (!args || typeof args !== "object") return {};

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
  category: { id: number; name: string } | null;
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
      category: { select: { id: true, name: true } },
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

  return {
    income: income.toFixed(2),
    expense: Math.abs(expenseRaw).toFixed(2),
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
      category: { select: { id: true, name: true } },
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
