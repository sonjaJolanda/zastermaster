export type BankId = "dkb" | "paypal" | "sparkasse" | "traderepublic";

export type NormalizedTransaction = {
  datum: Date;
  betrag: string;
  sender: string;
  empfaenger: string;
  verwendungszweck: string;
  iban: string;
  kundenreferenz: string;
  bank: BankId;
  konto: string;
  balance: string | null;
};

export type BankParseResult = {
  konto: string;
  accountIban: string;
  balance: string | null;
  rows: NormalizedTransaction[];
  /** Non-fatal notes for the UI (e.g. skipped pending rows). */
  warnings?: string[];
  skippedRows?: number;
};

/** Parse/validation error with optional fix hint for the Upload UI. */
export class ImportParseError extends Error {
  hint?: string;

  constructor(message: string, hint?: string) {
    super(hint ? `${message} — ${hint}` : message);
    this.name = "ImportParseError";
    this.hint = hint;
  }
}

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseGermanAmount(raw: string): string {
  let cleaned = raw
    .replace(/\u00a0/g, "")
    .replace(/\u202f/g, "")
    .replace(/\s/g, "")
    .replace(/€/g, "")
    .replace(/[−–—]/g, "-")
    .replace(/'/g, "");
  if (cleaned.endsWith("-")) {
    cleaned = `-${cleaned.slice(0, -1)}`;
  }

  const negative = cleaned.startsWith("-");
  const unsigned = cleaned.replace(/^[+-]/, "");

  // Comma = decimal (1.234,56). Dots without comma and groups of 3 =
  // thousands (1.200 → 1200). Otherwise leave as-is (1200 or 12.34).
  if (unsigned.includes(",")) {
    cleaned = `${negative ? "-" : ""}${unsigned.replace(/\./g, "").replace(",", ".")}`;
  } else if (/^\d{1,3}(\.\d{3})+$/.test(unsigned)) {
    cleaned = `${negative ? "-" : ""}${unsigned.replace(/\./g, "")}`;
  } else {
    cleaned = `${negative ? "-" : ""}${unsigned}`;
  }

  if (!cleaned || cleaned === "-" || cleaned === "+") {
    throw new ImportParseError(
      `Ungültiger Betrag: „${raw}“`,
      "Erwartet z. B. −12,34 oder 1.234,56.",
    );
  }
  const value = Number(cleaned);
  if (Number.isNaN(value)) {
    throw new ImportParseError(
      `Ungültiger Betrag: „${raw}“`,
      "Erwartet z. B. −12,34 oder 1.234,56.",
    );
  }
  return value.toFixed(2);
}

/** Dates like 24.07.26 or 02.01.2026 → Date at UTC midnight. */
export function parseGermanDate(raw: string): Date {
  const m = raw.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (!m) {
    throw new ImportParseError(
      `Ungültiges Datum: „${raw}“`,
      "Erwartet TT.MM.JJ oder TT.MM.JJJJ.",
    );
  }
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) {
    year += year >= 70 ? 1900 : 2000;
  }
  return new Date(Date.UTC(year, month - 1, day));
}

/** Rough check that content matches the selected bank (before full parse). */
export function detectLikelyBank(content: string): BankId | null {
  const head = stripBom(content).slice(0, 2500);
  if (
    head.includes("Buchungsdatum") &&
    (head.includes("Betrag (€)") || head.includes("Betrag (EUR)"))
  ) {
    return "dkb";
  }
  if (
    head.includes("Netto") &&
    (head.includes("Transaktionscode") || head.includes("Absender E-Mail"))
  ) {
    return "paypal";
  }
  if (
    (head.includes(":20:") || head.includes(":25:")) &&
    head.includes(":61:") &&
    head.includes(":86:")
  ) {
    return "sparkasse";
  }
  if (
    head.includes("datetime") &&
    head.includes("account_type") &&
    head.includes("transaction_id")
  ) {
    return "traderepublic";
  }
  return null;
}
