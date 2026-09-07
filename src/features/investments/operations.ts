import { HttpError } from "wasp/server";
import type {
  ClearInvestment,
  ConfirmInvestment,
  DetectInvestments,
  GetInvestedTotal,
  GetInvestmentKeywords,
  RejectInvestment,
  SetInvestmentKeywords,
} from "wasp/server/operations";
import {
  computeInvestedTotal,
  detectInvestmentSuggestions,
  type InvestmentSuggestion,
} from "./detect";

export type {
  InvestmentSuggestion,
} from "./detect";

export type InvestedTotal = {
  /** null when no confirmed investments yet */
  total: string | null;
  count: number;
};

export type DetectInvestmentsResult = {
  suggestions: InvestmentSuggestion[];
  truncated: boolean;
};

export type SetInvestmentKeywordsInput = {
  keywords: string[];
};

export type InvestmentIdArgs = {
  transactionId: number;
};

export const getInvestmentKeywords: GetInvestmentKeywords<
  void,
  string[]
> = async (_args, context) => {
  const rows = await context.entities.InvestmentKeyword.findMany({
    orderBy: { keyword: "asc" },
    select: { keyword: true },
  });
  return rows.map((r) => r.keyword);
};

export const setInvestmentKeywords: SetInvestmentKeywords<
  SetInvestmentKeywordsInput,
  string[]
> = async (args, context) => {
  const raw = args?.keywords;
  if (!Array.isArray(raw)) {
    throw new HttpError(400, "keywords muss ein Array sein.");
  }
  const cleaned = [
    ...new Set(
      raw
        .map((k) => (typeof k === "string" ? k.trim() : ""))
        .filter((k) => k.length > 0)
        .map((k) => k.slice(0, 120)),
    ),
  ];

  await context.entities.InvestmentKeyword.deleteMany({});
  if (cleaned.length > 0) {
    await context.entities.InvestmentKeyword.createMany({
      data: cleaned.map((keyword) => ({ keyword })),
    });
  }
  return cleaned.sort((a, b) => a.localeCompare(b, "de"));
};

export type InvestedTotalArgs = {
  banks?: string[];
  konten?: string[];
  dateFrom?: string;
  dateTo?: string;
};

function parseOptionalIsoDate(raw: string | undefined): Date | null {
  if (!raw?.trim()) return null;
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

export const getInvestedTotal: GetInvestedTotal<
  InvestedTotalArgs | void,
  InvestedTotal
> = async (args, context) => {
  const banks =
    args && typeof args === "object" && args.banks?.length
      ? args.banks
      : undefined;
  const konten =
    args && typeof args === "object" && args.konten?.length
      ? args.konten
      : undefined;
  const dateFrom =
    args && typeof args === "object"
      ? parseOptionalIsoDate(args.dateFrom)
      : null;
  const dateTo =
    args && typeof args === "object" ? parseOptionalIsoDate(args.dateTo) : null;
  const datum: { gte?: Date; lte?: Date } | undefined =
    dateFrom || dateTo
      ? {
          ...(dateFrom ? { gte: dateFrom } : {}),
          ...(dateTo ? { lte: dateTo } : {}),
        }
      : undefined;

  const rows = await context.entities.Transaction.findMany({
    where: {
      isInvestment: true,
      ...(banks ? { bank: { in: banks } } : {}),
      ...(konten ? { konto: { in: konten } } : {}),
      ...(datum ? { datum } : {}),
    },
    select: { betrag: true },
  });
  if (rows.length === 0) {
    return { total: null, count: 0 };
  }
  const amounts = rows.map((r) => Number(r.betrag.toString()));
  return {
    total: computeInvestedTotal(amounts).toFixed(2),
    count: rows.length,
  };
};

export const detectInvestments: DetectInvestments<
  void,
  DetectInvestmentsResult
> = async (_args, context) => {
  const keywords = await context.entities.InvestmentKeyword.findMany({
    select: { keyword: true },
  });
  if (keywords.length === 0) {
    return { suggestions: [], truncated: false };
  }

  const [rows, rejects] = await Promise.all([
    context.entities.Transaction.findMany({
      where: {
        isInvestment: false,
        isBalanceAdjustment: false,
      },
      select: {
        id: true,
        datum: true,
        betrag: true,
        sender: true,
        empfaenger: true,
        verwendungszweck: true,
        bank: true,
        konto: true,
      },
      orderBy: [{ datum: "desc" }, { id: "desc" }],
    }),
    context.entities.InvestmentRejection.findMany({
      select: { transactionId: true },
    }),
  ]);

  const rejectedIds = new Set(rejects.map((r) => r.transactionId));
  return detectInvestmentSuggestions(
    rows.map((r) => ({
      id: r.id,
      datum: r.datum,
      betrag: Number(r.betrag.toString()),
      sender: r.sender,
      empfaenger: r.empfaenger,
      verwendungszweck: r.verwendungszweck,
      bank: r.bank,
      konto: r.konto,
    })),
    keywords.map((k) => k.keyword),
    rejectedIds,
  );
};

export const confirmInvestment: ConfirmInvestment<
  InvestmentIdArgs,
  { ok: true }
> = async (args, context) => {
  if (!args?.transactionId) {
    throw new HttpError(400, "transactionId ist erforderlich.");
  }
  const tx = await context.entities.Transaction.findUnique({
    where: { id: args.transactionId },
    select: { id: true },
  });
  if (!tx) throw new HttpError(404, "Transaktion nicht gefunden.");

  await context.entities.Transaction.update({
    where: { id: args.transactionId },
    data: { isInvestment: true },
  });
  await context.entities.InvestmentRejection.deleteMany({
    where: { transactionId: args.transactionId },
  });
  return { ok: true };
};

export const rejectInvestment: RejectInvestment<
  InvestmentIdArgs,
  { ok: true }
> = async (args, context) => {
  if (!args?.transactionId) {
    throw new HttpError(400, "transactionId ist erforderlich.");
  }
  await context.entities.InvestmentRejection.upsert({
    where: { transactionId: args.transactionId },
    create: { transactionId: args.transactionId },
    update: {},
  });
  return { ok: true };
};

/** Remove investment flag (Details); also reject so detect won't re-offer. */
export const clearInvestment: ClearInvestment<
  InvestmentIdArgs,
  { ok: true }
> = async (args, context) => {
  if (!args?.transactionId) {
    throw new HttpError(400, "transactionId ist erforderlich.");
  }
  const tx = await context.entities.Transaction.findUnique({
    where: { id: args.transactionId },
    select: { id: true, isInvestment: true },
  });
  if (!tx) throw new HttpError(404, "Transaktion nicht gefunden.");
  if (!tx.isInvestment) {
    throw new HttpError(400, "Transaktion ist keine Investition.");
  }

  await context.entities.Transaction.update({
    where: { id: args.transactionId },
    data: { isInvestment: false },
  });
  await context.entities.InvestmentRejection.upsert({
    where: { transactionId: args.transactionId },
    create: { transactionId: args.transactionId },
    update: {},
  });
  return { ok: true };
};
