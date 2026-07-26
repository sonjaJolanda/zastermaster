import {
  ImportParseError,
  stripBom,
  type BankParseResult,
  type NormalizedTransaction,
} from "./types";

/** Minimal RFC4180-ish CSV (comma, quotes). */
function parseCommaCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const input = stripBom(text);

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\n") {
      pushField();
      pushRow();
    } else if (ch === "\r") {
      // ignore
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    pushField();
    pushRow();
  }
  return rows;
}

function parseIsoDate(raw: string): Date {
  const m = raw.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) {
    throw new ImportParseError(
      `Ungültiges Trade-Republic-Datum: „${raw}“`,
      "Erwartet YYYY-MM-DD in Spalte date.",
    );
  }
  return new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])),
  );
}

function parseDecimal(raw: string, label: string): number {
  const cleaned = raw.trim().replace(/\s/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (Number.isNaN(n)) {
    throw new ImportParseError(
      `Ungültiger ${label}: „${raw}“`,
      "Erwartet Dezimalzahl mit Punkt (z. B. -12.34).",
    );
  }
  return n;
}

/**
 * Parse Trade Republic cash/transactions CSV export.
 * Cash impact = amount + fee + tax (EUR rows only).
 */
export function parseTradeRepublicCsv(content: string): BankParseResult {
  if (!content.trim()) {
    throw new ImportParseError(
      "Trade-Republic-Datei ist leer.",
      "Bitte den CSV-Export „transactions“ hochladen.",
    );
  }

  const table = parseCommaCsv(content);
  if (table.length < 2) {
    throw new ImportParseError(
      "Trade-Republic-Datei ist zu kurz.",
      "Erwartet Kopfzeile mit date / amount / currency.",
    );
  }

  const header = table[0]!.map((h) => h.trim().replace(/^"|"$/g, ""));
  const required = ["date", "amount", "currency"];
  for (const col of required) {
    if (!header.includes(col)) {
      throw new ImportParseError(
        `Trade-Republic-Spalte fehlt: ${col}`,
        "Neuer Export? Erwartet u. a. date, amount, currency, description.",
      );
    }
  }

  const idx = (name: string) => header.indexOf(name);
  const iDate = idx("date");
  const iAmount = idx("amount");
  const iFee = idx("fee");
  const iTax = idx("tax");
  const iCurrency = idx("currency");
  const iDesc = idx("description");
  const iName = idx("name");
  const iType = idx("type");
  const iTxId = idx("transaction_id");
  const iCpName = idx("counterparty_name");
  const iCpIban = idx("counterparty_iban");
  const iPayRef = idx("payment_reference");

  const warnings: string[] = [];
  let skippedRows = 0;
  const rows: NormalizedTransaction[] = [];

  for (let r = 1; r < table.length; r++) {
    const cells = table[r]!;
    if (cells.every((c) => !c.trim())) continue;

    const currency = (cells[iCurrency] ?? "").trim().toUpperCase();
    if (currency && currency !== "EUR") {
      skippedRows++;
      continue;
    }

    let cash = parseDecimal(cells[iAmount] ?? "", "amount");
    if (iFee >= 0) cash += parseDecimal(cells[iFee] ?? "", "fee");
    if (iTax >= 0) cash += parseDecimal(cells[iTax] ?? "", "tax");

    if (cash === 0) {
      skippedRows++;
      continue;
    }

    const dateRaw = cells[iDate] ?? "";
    let datum: Date;
    try {
      datum = parseIsoDate(dateRaw);
    } catch (err) {
      throw new ImportParseError(
        err instanceof Error ? err.message : "Datum ungültig",
        `Zeile ${r + 1}.`,
      );
    }

    const description = (iDesc >= 0 ? cells[iDesc] : "")?.trim() ?? "";
    const name = (iName >= 0 ? cells[iName] : "")?.trim() ?? "";
    const type = (iType >= 0 ? cells[iType] : "")?.trim() ?? "";
    const txId = (iTxId >= 0 ? cells[iTxId] : "")?.trim() ?? "";
    const cpName = (iCpName >= 0 ? cells[iCpName] : "")?.trim() ?? "";
    const cpIban = (iCpIban >= 0 ? cells[iCpIban] : "")?.trim() ?? "";
    const payRef = (iPayRef >= 0 ? cells[iPayRef] : "")?.trim() ?? "";

    const zweck = [type, name, description, payRef]
      .filter(Boolean)
      .join(" · ")
      .slice(0, 2000);

    const isExpense = cash < 0;
    const counterparty = cpName || name;

    rows.push({
      datum,
      betrag: cash.toFixed(2),
      sender: isExpense ? "" : counterparty,
      empfaenger: isExpense ? counterparty : "",
      verwendungszweck: zweck || type || "Trade Republic",
      iban: cpIban,
      kundenreferenz: txId,
      bank: "traderepublic",
      konto: "Trade Republic",
      balance: null,
    });
  }

  if (rows.length === 0) {
    throw new ImportParseError(
      "Keine Trade-Republic-Buchungen (EUR) gefunden.",
      "Nur EUR-Zeilen mit Cash-Effekt werden importiert.",
    );
  }

  if (skippedRows > 0) {
    warnings.push(
      `${skippedRows} Zeile(n) übersprungen (Nicht-EUR oder Betrag 0).`,
    );
  }

  return {
    konto: "Trade Republic",
    accountIban: "",
    balance: null,
    rows,
    warnings: warnings.length ? warnings : undefined,
    skippedRows: skippedRows || undefined,
  };
}
