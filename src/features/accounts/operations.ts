import { HttpError } from "wasp/server";
import type {
  GetHeaderBalance,
  SetAccountBalance,
} from "wasp/server/operations";

export type HeaderBalance = {
  total: string | null;
  calibratedCount: number;
  accountCount: number;
};

export type SetAccountBalanceInput = {
  accountId: number;
  currentBalance: string;
  asOfDate: string; // YYYY-MM-DD
};

function parseBalanceInput(raw: string): string {
  let cleaned = raw
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "")
    .replace("€", "");
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  }
  const value = Number(cleaned);
  if (!cleaned || Number.isNaN(value)) {
    throw new HttpError(400, `Ungültiger Kontostand: "${raw}"`);
  }
  return value.toFixed(2);
}

function parseIsoDate(raw: string): Date {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) {
    throw new HttpError(400, `Ungültiges Datum (YYYY-MM-DD): "${raw}"`);
  }
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

/** Sum of calibrated account balances for the header. */
export const getHeaderBalance: GetHeaderBalance<void, HeaderBalance> = async (
  _args,
  context,
) => {
  const accounts = await context.entities.Account.findMany({
    select: { currentBalance: true },
  });

  let calibratedCount = 0;
  let sum = 0;
  for (const account of accounts) {
    if (account.currentBalance == null) continue;
    calibratedCount++;
    sum += Number(account.currentBalance.toString());
  }

  return {
    total: calibratedCount > 0 ? sum.toFixed(2) : null,
    calibratedCount,
    accountCount: accounts.length,
  };
};

export const setAccountBalance: SetAccountBalance<
  SetAccountBalanceInput,
  { id: number; currentBalance: string; asOfDate: string }
> = async (args, context) => {
  if (!args?.accountId) {
    throw new HttpError(400, "accountId ist erforderlich.");
  }

  const existing = await context.entities.Account.findUnique({
    where: { id: args.accountId },
    select: { id: true },
  });
  if (!existing) {
    throw new HttpError(404, "Konto nicht gefunden.");
  }

  const currentBalance = parseBalanceInput(args.currentBalance);
  const asOfDate = parseIsoDate(args.asOfDate || new Date().toISOString().slice(0, 10));

  const updated = await context.entities.Account.update({
    where: { id: args.accountId },
    data: { currentBalance, asOfDate },
    select: { id: true, currentBalance: true, asOfDate: true },
  });

  return {
    id: updated.id,
    currentBalance: updated.currentBalance!.toString(),
    asOfDate: updated.asOfDate!.toISOString().slice(0, 10),
  };
};
