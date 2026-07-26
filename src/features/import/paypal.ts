import {
  parseGermanAmount,
  parseGermanDate,
  stripBom,
  type BankParseResult,
  type NormalizedTransaction,
} from "./types";

/** Minimal TSV parser for quoted PayPal exports. */
function parseTabCsv(text: string): string[][] {
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
    } else if (ch === "\t") {
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

/**
 * Parse a PayPal activity TSV/TXT export (German headers).
 * Only completed EUR rows; pending authorizations are skipped.
 */
export function parsePaypalTxt(content: string): BankParseResult {
  const rows = parseTabCsv(content);
  if (rows.length < 2) {
    throw new Error("PayPal-Datei ist zu kurz oder leer.");
  }

  const header = rows[0]!;
  if (!header.includes("Datum") || !header.includes("Netto")) {
    throw new Error(
      "PayPal-Kopfzeile fehlt (erwartet Spalten Datum / Netto / Status).",
    );
  }

  const col = (name: string) => {
    const i = header.indexOf(name);
    if (i < 0) throw new Error(`PayPal-Spalte fehlt: ${name}`);
    return i;
  };

  const iDatum = col("Datum");
  const iName = col("Name");
  const iTyp = col("Typ");
  const iStatus = col("Status");
  const iCurrency = col("Währung");
  const iNetto = col("Netto");
  const iFrom = col("Absender E-Mail-Adresse");
  const iTo = col("Empfänger E-Mail-Adresse");
  const iCode = col("Transaktionscode");
  const iArtikel = header.indexOf("Artikelbezeichnung");
  const iBetreff = header.indexOf("Betreff");
  const iHinweis = header.indexOf("Hinweis");
  const iGuthaben = header.indexOf("Guthaben");

  const out: NormalizedTransaction[] = [];
  let balance: string | null = null;

  for (const row of rows.slice(1)) {
    if (!row.some((c) => c.trim())) continue;
    if ((row[iStatus] ?? "").trim() !== "Abgeschlossen") continue;
    if ((row[iCurrency] ?? "").trim().toUpperCase() !== "EUR") continue;

    const datumRaw = (row[iDatum] ?? "").trim();
    const nettoRaw = (row[iNetto] ?? "").trim();
    if (!datumRaw || !nettoRaw) continue;

    const betrag = parseGermanAmount(nettoRaw);
    const amount = Number(betrag);
    const name = (row[iName] ?? "").trim();
    const fromEmail = (row[iFrom] ?? "").trim();
    const toEmail = (row[iTo] ?? "").trim();

    let sender: string;
    let empfaenger: string;
    if (amount < 0) {
      sender = fromEmail || "PayPal";
      empfaenger = name || toEmail;
    } else {
      sender = name || fromEmail;
      empfaenger = toEmail || "PayPal";
    }

    const zweckParts = [
      (row[iTyp] ?? "").trim(),
      name,
      iBetreff >= 0 ? (row[iBetreff] ?? "").trim() : "",
      iHinweis >= 0 ? (row[iHinweis] ?? "").trim() : "",
      iArtikel >= 0 ? (row[iArtikel] ?? "").trim() : "",
    ].filter(Boolean);

    const guthabenRaw =
      iGuthaben >= 0 ? (row[iGuthaben] ?? "").trim() : "";
    if (guthabenRaw) {
      try {
        balance = parseGermanAmount(guthabenRaw);
      } catch {
        // keep previous
      }
    }

    out.push({
      datum: parseGermanDate(datumRaw),
      betrag,
      sender,
      empfaenger,
      verwendungszweck: zweckParts.join(" · "),
      iban: "",
      kundenreferenz: (row[iCode] ?? "").trim(),
      bank: "paypal",
      konto: "PayPal",
      balance: null,
    });
  }

  if (out.length === 0) {
    throw new Error(
      "Keine abgeschlossenen EUR-Buchungen in der PayPal-Datei gefunden.",
    );
  }

  // Attach latest known balance snapshot to all rows (metadata only).
  if (balance) {
    for (const row of out) {
      row.balance = balance;
    }
  }

  return {
    konto: "PayPal",
    accountIban: "",
    balance,
    rows: out,
  };
}
