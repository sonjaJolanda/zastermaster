import {
  ImportParseError,
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
  return rows.findIndex((r) => {
    const first = r[0]?.trim();
    if (first !== "Buchungsdatum") return false;
    return r.some(
      (c) => c.trim() === "Betrag (€)" || c.trim() === "Betrag (EUR)",
    );
  });
}

function findAmountCol(header: string[]): number {
  const euro = header.indexOf("Betrag (€)");
  if (euro >= 0) return euro;
  return header.indexOf("Betrag (EUR)");
}

/**
 * Canonical DKB account labels so Giro/Tagesgeld don't fragment into
 * "Girokonto", "DKB Giro", filename variants, etc.
 */
export function normalizeDkbKonto(
  rawLabel: string,
  fileName?: string,
): { konto: string; normalized: boolean } {
  const label = rawLabel.trim();
  const blob = `${label} ${fileName ?? ""}`.toLowerCase();

  if (
    blob.includes("tagesgeld") ||
    blob.includes("tagesgeldkonto") ||
    blob.includes("callmoney")
  ) {
    return { konto: "Tagesgeld", normalized: label !== "Tagesgeld" };
  }
  if (
    blob.includes("girokonto") ||
    blob.includes("giro konto") ||
    /(^|[^a-z])giro([^a-z]|$)/.test(blob) ||
    blob.includes("zahlungsverkehr")
  ) {
    return { konto: "Girokonto", normalized: label !== "Girokonto" };
  }

  return { konto: label || "DKB", normalized: false };
}

/**
 * Parse a DKB Girokonto / Tagesgeld Umsatzliste CSV (UTF-8, semicolon).
 */
export function parseDkbCsv(
  content: string,
  fileName?: string,
): BankParseResult {
  if (!content.trim()) {
    throw new ImportParseError(
      "DKB-Datei ist leer.",
      "Bitte eine Umsatzliste (CSV) von DKB hochladen.",
    );
  }

  const rows = parseSemicolonCsv(content);
  if (rows.length < 5) {
    throw new ImportParseError(
      "DKB-Datei ist zu kurz oder leer.",
      "Erwartet Kopfzeile mit Kontoname/IBAN, dann Tabelle ab „Buchungsdatum“.",
    );
  }

  const meta = rows[0] ?? [];
  const rawKonto = (meta[0] ?? "").trim();
  const accountIban = (meta[1] ?? "").trim();
  if (!rawKonto || !accountIban) {
    throw new ImportParseError(
      "DKB-Kopfzeile fehlt.",
      'Erste Zeile sollte z. B. „Girokonto“;„DE62…“ oder „Tagesgeld“;„DE91…“ sein.',
    );
  }
  if (!/^DE\d{20}$/i.test(accountIban.replace(/\s/g, ""))) {
    // Soft: many exports are fine; only warn via not throwing — IBAN format can vary.
  }

  const { konto, normalized } = normalizeDkbKonto(rawKonto, fileName);
  const warnings: string[] = [];
  if (normalized && rawKonto && rawKonto !== konto) {
    warnings.push(`Konto als „${konto}“ erkannt (Datei: „${rawKonto}“).`);
  }

  let balance: string | null = null;
  const balanceRow = rows.find((r) => (r[0] ?? "").startsWith("Kontostand"));
  if (balanceRow?.[1]) {
    try {
      balance = parseGermanAmount(balanceRow[1]);
    } catch {
      warnings.push("Kontostand in der Datei konnte nicht gelesen werden.");
      balance = null;
    }
  }

  const headerIndex = findHeaderIndex(rows);
  if (headerIndex < 0) {
    throw new ImportParseError(
      "DKB-Tabellenkopf nicht gefunden.",
      "Gesucht wird eine Zeile mit „Buchungsdatum“ und „Betrag (€)“.",
    );
  }

  const header = rows[headerIndex]!;
  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) {
      throw new ImportParseError(
        `Spalte fehlt: ${name}`,
        "Stimmt die Bank-Auswahl (DKB)? PayPal-Exporte hier nicht wählen.",
      );
    }
    return i;
  };

  const iDatum = col("Buchungsdatum");
  const iSender = col("Zahlungspflichtige*r");
  const iEmpfaenger = col("Zahlungsempfänger*in");
  const iZweck = col("Verwendungszweck");
  const iIban = col("IBAN");
  const iBetrag = findAmountCol(header);
  if (iBetrag < 0) {
    throw new ImportParseError(
      "Spalte fehlt: Betrag (€)",
      "DKB-Umsatzlisten brauchen die Spalte „Betrag (€)“.",
    );
  }
  const iRef = header.indexOf("Kundenreferenz");
  const iStatus = header.indexOf("Status");

  const out: NormalizedTransaction[] = [];
  let skippedRows = 0;
  let rowErrors = 0;

  for (let ri = headerIndex + 1; ri < rows.length; ri++) {
    const row = rows[ri]!;
    if (!row.some((c) => c.trim())) continue;
    if (iStatus >= 0) {
      const status = (row[iStatus] ?? "").trim();
      if (status && status !== "Gebucht") {
        skippedRows += 1;
        continue;
      }
    }
    const datumRaw = (row[iDatum] ?? "").trim();
    const betragRaw = (row[iBetrag] ?? "").trim();
    if (!datumRaw || !betragRaw) {
      skippedRows += 1;
      continue;
    }

    try {
      out.push({
        datum: parseGermanDate(datumRaw),
        betrag: parseGermanAmount(betragRaw),
        sender: (row[iSender] ?? "").trim(),
        empfaenger: (row[iEmpfaenger] ?? "").trim(),
        verwendungszweck: (row[iZweck] ?? "").trim(),
        iban: (row[iIban] ?? "").trim(),
        kundenreferenz: iRef >= 0 ? (row[iRef] ?? "").trim() : "",
        bank: "dkb",
        konto,
        balance,
      });
    } catch {
      rowErrors += 1;
      skippedRows += 1;
    }
  }

  if (out.length === 0) {
    throw new ImportParseError(
      "Keine Buchungszeilen in der DKB-Datei gefunden.",
      skippedRows > 0
        ? `${skippedRows} Zeile(n) übersprungen (Status nicht „Gebucht“ oder ungültig).`
        : "Enthält die Datei gebuchte Umsätze?",
    );
  }

  if (skippedRows > 0) {
    warnings.push(
      `${skippedRows} Zeile(n) übersprungen (nicht gebucht / leer / ungültig).`,
    );
  }
  if (rowErrors > 0) {
    warnings.push(`${rowErrors} Zeile(n) wegen Datums-/Betragsfehler übersprungen.`);
  }

  return {
    konto,
    accountIban,
    balance,
    rows: out,
    warnings: warnings.length ? warnings : undefined,
    skippedRows: skippedRows || undefined,
  };
}
