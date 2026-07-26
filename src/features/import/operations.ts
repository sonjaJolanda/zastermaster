import { HttpError } from "wasp/server";
import type { ImportBankFile } from "wasp/server/operations";
import {
  buildKeywordCatalog,
  categorizeRow,
  type CategoryTreeForMatch,
} from "../categorization/categorizeRow";
import { parseDkbCsv } from "./dkb";
import { parsePaypalTxt } from "./paypal";
import type { BankId, BankParseResult } from "./types";

export type ImportBankFileInput = {
  bank: BankId;
  fileName: string;
  content: string;
};

export type ImportBankFileResult = {
  success: true;
  importedCount: number;
  duplicateCount: number;
  parsedCount: number;
  konto: string;
  fileName: string;
  accountId: number;
  bank: string;
  needsBalanceCalibration: boolean;
  suggestedBalance: string | null;
};

function parseBankFile(bank: BankId, content: string): BankParseResult {
  if (bank === "dkb") return parseDkbCsv(content);
  if (bank === "paypal") return parsePaypalTxt(content);
  throw new HttpError(400, `Bank "${bank}" wird noch nicht unterstützt.`);
}

export const importBankFile: ImportBankFile<
  ImportBankFileInput,
  ImportBankFileResult
> = async (args, context) => {
  if (!args?.bank || !args.content) {
    throw new HttpError(400, "bank und content sind erforderlich.");
  }

  let parsed: BankParseResult;
  try {
    parsed = parseBankFile(args.bank, args.content);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(
      400,
      err instanceof Error
        ? err.message
        : "Datei konnte nicht gelesen werden.",
    );
  }

  const categoryCount = await context.entities.Category.count();
  if (categoryCount === 0) {
    throw new HttpError(
      400,
      "Keine Kategorien vorhanden. Bitte zuerst Einstellungen öffnen (Seed).",
    );
  }

  const categories = await context.entities.Category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      keywords: true,
      subcategories: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { keywords: true },
      },
    },
  });

  const tree: CategoryTreeForMatch[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    keywords: c.keywords.map((k) => k.keyword),
    subcategories: c.subcategories.map((s) => ({
      id: s.id,
      name: s.name,
      keywords: s.keywords.map((k) => k.keyword),
    })),
  }));

  const catalog = buildKeywordCatalog(tree);

  let importedCount = 0;
  let duplicateCount = 0;

  for (const row of parsed.rows) {
    const iban = row.iban || "";
    const kundenreferenz = row.kundenreferenz || "";
    const verwendungszweck = row.verwendungszweck || "";

    const existing = await context.entities.Transaction.findFirst({
      where: {
        bank: row.bank,
        konto: row.konto,
        datum: row.datum,
        betrag: row.betrag,
        verwendungszweck,
        iban,
        kundenreferenz,
      },
      select: { id: true },
    });

    if (existing) {
      duplicateCount++;
      continue;
    }

    const cat = categorizeRow(catalog, {
      sender: row.sender,
      empfaenger: row.empfaenger,
      verwendungszweck,
    });

    await context.entities.Transaction.create({
      data: {
        datum: row.datum,
        betrag: row.betrag,
        sender: row.sender,
        empfaenger: row.empfaenger,
        verwendungszweck,
        iban,
        kundenreferenz,
        bank: row.bank,
        konto: row.konto,
        balance: row.balance,
        categoryId: cat.categoryId,
        subcategoryId: cat.subcategoryId,
        confidenceScore: cat.confidenceScore,
        categorySource: cat.categorySource,
      },
    });
    importedCount++;
  }

  const account = await context.entities.Account.upsert({
    where: {
      bank_konto: { bank: args.bank, konto: parsed.konto },
    },
    create: {
      bank: args.bank,
      konto: parsed.konto,
      accountIban: parsed.accountIban || "",
    },
    update: {
      accountIban: parsed.accountIban || undefined,
    },
  });

  return {
    success: true,
    importedCount,
    duplicateCount,
    parsedCount: parsed.rows.length,
    konto: parsed.konto,
    fileName: args.fileName || "unbenannt",
    accountId: account.id,
    bank: args.bank,
    needsBalanceCalibration: account.currentBalance == null,
    suggestedBalance: parsed.balance,
  };
};
