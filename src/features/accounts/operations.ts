import { HttpError } from "wasp/server";
import type {
  GetAccounts,
  GetHeaderBalance,
  SetAccountBalance,
} from "wasp/server/operations";

export type HeaderBalance = {
  total: string | null;
  calibratedCount: number;
  accountCount: number;
};

export type AccountListItem = {
  id: number;
  bank: string;
  konto: string;
  accountIban: string;
  currentBalance: string | null;
  asOfDate: string | null;
  /** Roll-forward display for this account (null if not calibrated). */
  displayBalance: string | null;
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

async function rollForwardBalance(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Transaction: any,
  account: {
    bank: string;
    konto: string;
    currentBalance: { toString(): string } | null;
    asOfDate: Date | null;
  },
): Promise<number | null> {
  if (account.currentBalance == null || account.asOfDate == null) {
    return null;
  }
  const base = Number(account.currentBalance.toString());
  const agg = await Transaction.aggregate({
    where: {
      bank: account.bank,
      konto: account.konto,
      datum: { gt: account.asOfDate },
      isBalanceAdjustment: false,
    },
    _sum: { betrag: true },
  });
  const delta = Number(agg._sum.betrag?.toString?.() ?? agg._sum.betrag ?? 0);
  return base + delta;
}

/**
 * Header wealth = sum over calibrated accounts of
 * currentBalance + sum(betrag) where datum > asOfDate (end-of-day cutoff).
 */
export const getHeaderBalance: GetHeaderBalance<void, HeaderBalance> = async (
  _args,
  context,
) => {
  const accounts = await context.entities.Account.findMany({
    select: {
      bank: true,
      konto: true,
      currentBalance: true,
      asOfDate: true,
    },
  });

  let calibratedCount = 0;
  let sum = 0;
  for (const account of accounts) {
    const display = await rollForwardBalance(context.entities.Transaction, account);
    if (display == null) continue;
    calibratedCount++;
    sum += display;
  }

  return {
    total: calibratedCount > 0 ? sum.toFixed(2) : null,
    calibratedCount,
    accountCount: accounts.length,
  };
};

export const getAccounts: GetAccounts<void, AccountListItem[]> = async (
  _args,
  context,
) => {
  const accounts = await context.entities.Account.findMany({
    orderBy: [{ bank: "asc" }, { konto: "asc" }],
  });

  const out: AccountListItem[] = [];
  for (const account of accounts) {
    const display = await rollForwardBalance(context.entities.Transaction, account);
    out.push({
      id: account.id,
      bank: account.bank,
      konto: account.konto,
      accountIban: account.accountIban,
      currentBalance:
        account.currentBalance != null
          ? account.currentBalance.toString()
          : null,
      asOfDate: account.asOfDate
        ? account.asOfDate.toISOString().slice(0, 10)
        : null,
      displayBalance: display != null ? display.toFixed(2) : null,
    });
  }
  return out;
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
    select: { id: true, bank: true, konto: true },
  });
  if (!existing) {
    throw new HttpError(404, "Konto nicht gefunden.");
  }

  const currentBalance = parseBalanceInput(args.currentBalance);
  const asOfDate = parseIsoDate(
    args.asOfDate || new Date().toISOString().slice(0, 10),
  );

  const updated = await context.entities.Account.update({
    where: { id: args.accountId },
    data: { currentBalance, asOfDate },
    select: { id: true, currentBalance: true, asOfDate: true },
  });

  // Audit marker row (betrag 0); excluded from Analyse / default list.
  const markerZweck = `Saldo-Kalibrierung ${asOfDate.toISOString().slice(0, 10)}`;
  const existingMarker = await context.entities.Transaction.findFirst({
    where: {
      bank: existing.bank,
      konto: existing.konto,
      datum: asOfDate,
      betrag: "0.00",
      verwendungszweck: markerZweck,
      iban: "",
      kundenreferenz: "",
    },
    select: { id: true },
  });
  if (!existingMarker) {
    await context.entities.Transaction.create({
      data: {
        bank: existing.bank,
        konto: existing.konto,
        datum: asOfDate,
        betrag: "0.00",
        sender: "",
        empfaenger: "",
        verwendungszweck: markerZweck,
        iban: "",
        kundenreferenz: "",
        balance: currentBalance,
        isBalanceAdjustment: true,
        categorySource: "none",
        confidenceScore: 0,
      },
    });
  } else {
    await context.entities.Transaction.update({
      where: { id: existingMarker.id },
      data: {
        balance: currentBalance,
        isBalanceAdjustment: true,
      },
    });
  }

  return {
    id: updated.id,
    currentBalance: updated.currentBalance!.toString(),
    asOfDate: updated.asOfDate!.toISOString().slice(0, 10),
  };
};
