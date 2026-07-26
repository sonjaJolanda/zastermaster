import {
  parseGermanAmount,
  parseGermanDate,
  stripBom,
  type BankParseResult,
  type NormalizedTransaction,
} from "./types";

export type { BankParseResult as DkbParseResult, NormalizedTransaction };

/** Minimal semicolon CSV parser (quoted fields, "" escapes). */
export function parseSemicolonCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    rows.push(row);
    row = [];
  };

  const input = stripBom(text);
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
    } else if (ch === ";") {
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

export function parseDkbDate(raw: string): Date {
  return parseGermanDate(raw);
}

function findHeaderIndex(rows: string[][]): number {
  return rows.findIndex(
    (r) => r[0]?.trim() === "Buchungsdatum" && r.includes("Betrag (€)"),
  );
}

/**
 * Parse a DKB Girokonto / Tagesgeld Umsatzliste CSV (UTF-8, semicolon).
 */
export function parseDkbCsv(content: string): BankParseResult {
  const rows = parseSemicolonCsv(content);
  if (rows.length < 5) {
    throw new Error("DKB-Datei ist zu kurz oder leer.");
  }

  const meta = rows[0] ?? [];
  const konto = (meta[0] ?? "").trim();
  const accountIban = (meta[1] ?? "").trim();
  if (!konto || !accountIban) {
    throw new Error(
      'DKB-Kopfzeile fehlt (erwartet z. B. "Girokonto";"DE…").',
    );
  }

  let balance: string | null = null;
  const balanceRow = rows.find((r) => (r[0] ?? "").startsWith("Kontostand"));
  if (balanceRow?.[1]) {
    try {
      balance = parseGermanAmount(balanceRow[1]);
    } catch {
      balance = null;
    }
  }

  const headerIndex = findHeaderIndex(rows);
  if (headerIndex < 0) {
    throw new Error("DKB-Tabellenkopf (Buchungsdatum / Betrag) nicht gefunden.");
  }

  const header = rows[headerIndex]!;
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`Spalte fehlt: ${name}`);
    return i;
  };

  const iDatum = col("Buchungsdatum");
  const iSender = col("Zahlungspflichtige*r");
  const iEmpfaenger = col("Zahlungsempfänger*in");
  const iZweck = col("Verwendungszweck");
  const iIban = col("IBAN");
  const iBetrag = col("Betrag (€)");
  const iRef = col("Kundenreferenz");
  const iStatus = header.indexOf("Status");

  const out: NormalizedTransaction[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    if (!row.some((c) => c.trim())) continue;
    if (iStatus >= 0) {
      const status = (row[iStatus] ?? "").trim();
      if (status && status !== "Gebucht") continue;
    }
    const datumRaw = (row[iDatum] ?? "").trim();
    const betragRaw = (row[iBetrag] ?? "").trim();
    if (!datumRaw || !betragRaw) continue;

    out.push({
      datum: parseGermanDate(datumRaw),
      betrag: parseGermanAmount(betragRaw),
      sender: (row[iSender] ?? "").trim(),
      empfaenger: (row[iEmpfaenger] ?? "").trim(),
      verwendungszweck: (row[iZweck] ?? "").trim(),
      iban: (row[iIban] ?? "").trim(),
      kundenreferenz: (row[iRef] ?? "").trim(),
      bank: "dkb",
      konto,
      balance,
    });
  }

  if (out.length === 0) {
    throw new Error("Keine Buchungszeilen in der DKB-Datei gefunden.");
  }

  return { konto, accountIban, balance, rows: out };
}
