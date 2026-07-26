export type BankId = "dkb" | "paypal";

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
};

export function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseGermanAmount(raw: string): string {
  let cleaned = raw
    .replace(/\u00a0/g, "")
    .replace(/\s/g, "")
    .replace("€", "");
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (cleaned.includes(",")) {
    cleaned = cleaned.replace(",", ".");
  }
  if (!cleaned || cleaned === "-" || cleaned === "+") {
    throw new Error(`Ungültiger Betrag: "${raw}"`);
  }
  const value = Number(cleaned);
  if (Number.isNaN(value)) {
    throw new Error(`Ungültiger Betrag: "${raw}"`);
  }
  return value.toFixed(2);
}

/** Dates like 24.07.26 or 02.01.2026 → Date at UTC midnight. */
export function parseGermanDate(raw: string): Date {
  const m = raw.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/);
  if (!m) throw new Error(`Ungültiges Datum: "${raw}"`);
  const day = Number(m[1]);
  const month = Number(m[2]);
  let year = Number(m[3]);
  if (year < 100) {
    year += year >= 70 ? 1900 : 2000;
  }
  return new Date(Date.UTC(year, month - 1, day));
}
