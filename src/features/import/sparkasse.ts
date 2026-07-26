import {
  ImportParseError,
  parseGermanAmount,
  stripBom,
  type BankParseResult,
  type NormalizedTransaction,
} from "./types";

/**
 * Sparkasse / German bank MT940-like export (:20:/:25:/:61:/:86:/:62F:).
 * Statements may be concatenated with "-" separators.
 */

function yyMmDdToDate(raw: string): Date {
  if (!/^\d{6}$/.test(raw)) {
    throw new ImportParseError(
      `Ungültiges MT940-Datum: „${raw}“`,
      "Erwartet JJMMTT im Feld :61:.",
    );
  }
  let year = Number(raw.slice(0, 2));
  year += year >= 70 ? 1900 : 2000;
  const month = Number(raw.slice(2, 4));
  const day = Number(raw.slice(4, 6));
  return new Date(Date.UTC(year, month - 1, day));
}

/** Join physical lines; tags start a new logical line. */
function logicalLines(content: string): string[] {
  const raw = stripBom(content).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const out: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith(":") || line === "-") {
      out.push(line);
    } else if (out.length > 0) {
      out[out.length - 1] = out[out.length - 1] + line;
    }
  }
  return out;
}

type Parsed61 = {
  valueDate: Date;
  debitCredit: "D" | "C";
  amount: string;
  reference: string;
};

function parseField61(body: string): Parsed61 {
  // YYMMDD [MMDD] C|D [funds] amount Nxxx reference
  const m = body.match(
    /^(\d{6})(\d{4})?([CD])([A-Z])?(\d[\d.,]*)N(.{3})(.*)$/,
  );
  if (!m) {
    throw new ImportParseError(
      `MT940-Feld :61: unerwartet: „${body.slice(0, 48)}“`,
      "Export ggf. erneut als MT940 speichern; Formatdrift möglich.",
    );
  }
  const valueDate = yyMmDdToDate(m[1]!);
  const debitCredit = m[3] as "D" | "C";
  const amountAbs = parseGermanAmount(m[5]!);
  const amount =
    debitCredit === "D"
      ? (-Number(amountAbs)).toFixed(2)
      : Number(amountAbs).toFixed(2);
  return {
    valueDate,
    debitCredit,
    amount,
    reference: (m[7] || "").trim(),
  };
}

type Sepa86 = {
  bookingText: string;
  purpose: string;
  iban: string;
  name: string;
};

function parseField86(body: string): Sepa86 {
  // Drop leading GVC code like "105" before first ?
  const q = body.indexOf("?");
  const payload = q >= 0 ? body.slice(q) : body;
  const parts = new Map<string, string>();
  const re = /\?(\d{2})([^\?]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(payload)) !== null) {
    const code = m[1]!;
    const val = m[2] ?? "";
    parts.set(code, (parts.get(code) ?? "") + val);
  }

  const bookingText = (parts.get("00") ?? "").trim();
  const purposeParts: string[] = [];
  for (let i = 20; i <= 29; i++) {
    const key = String(i);
    if (parts.has(key)) purposeParts.push(parts.get(key)!);
  }
  // Some banks put SVWZ elsewhere; also fold ?60 continuation text occasionally
  for (const k of ["60", "61", "62", "63"]) {
    if (parts.has(k)) purposeParts.push(parts.get(k)!);
  }
  const purpose = purposeParts.join("").replace(/\s+/g, " ").trim();
  const iban = (parts.get("31") ?? "").replace(/\s/g, "").trim();
  const name = `${parts.get("32") ?? ""}${parts.get("33") ?? ""}`
    .replace(/\s+/g, " ")
    .trim();

  return { bookingText, purpose, iban, name };
}

function parseBalance62(body: string): string | null {
  // C250728EUR7894,57 or D...
  const m = body.match(/^[CD]\d{6}[A-Z]{3}([\d.,]+)$/);
  if (!m) return null;
  try {
    return parseGermanAmount(m[1]!);
  } catch {
    return null;
  }
}

/**
 * Parse Sparkasse MT940-like TXT into normalized transactions.
 */
export function parseSparkasseMt940(content: string): BankParseResult {
  if (!content.trim()) {
    throw new ImportParseError(
      "Sparkasse-Datei ist leer.",
      "Bitte einen MT940-/Umsatzexport (.TXT) hochladen.",
    );
  }

  const lines = logicalLines(content);
  const has61 = lines.some((l) => l.startsWith(":61:"));
  const has86 = lines.some((l) => l.startsWith(":86:"));
  if (!has61 || !has86) {
    throw new ImportParseError(
      "Kein MT940-Umsatz erkannt.",
      "Erwartet Felder :61: und :86:. Stimmt die Bank-Auswahl (Sparkasse)?",
    );
  }

  let accountRef = "";
  let lastBalance: string | null = null;
  const warnings: string[] = [];
  let skippedRows = 0;
  const rows: NormalizedTransaction[] = [];

  let pending61: Parsed61 | null = null;

  const flushPendingWithout86 = () => {
    if (!pending61) return;
    warnings.push(
      `Buchung ohne :86:-Details übersprungen (${pending61.valueDate.toISOString().slice(0, 10)}).`,
    );
    skippedRows++;
    pending61 = null;
  };

  for (const line of lines) {
    if (line === "-") {
      flushPendingWithout86();
      continue;
    }
    if (!line.startsWith(":")) continue;
    const tagEnd = line.indexOf(":", 1);
    if (tagEnd < 0) continue;
    const tag = line.slice(1, tagEnd);
    const body = line.slice(tagEnd + 1);

    if (tag === "25") {
      accountRef = body.trim();
      continue;
    }
    if (tag === "62F" || tag === "62M") {
      lastBalance = parseBalance62(body) ?? lastBalance;
      continue;
    }
    if (tag === "61") {
      flushPendingWithout86();
      pending61 = parseField61(body);
      continue;
    }
    if (tag === "86") {
      if (!pending61) {
        warnings.push("Feld :86: ohne vorausgehendes :61: ignoriert.");
        continue;
      }
      const f61 = pending61;
      pending61 = null;
      const f86 = parseField86(body);

      if (Number(f61.amount) === 0) {
        skippedRows++;
        continue;
      }

      const purpose =
        f86.purpose ||
        f86.bookingText ||
        (f61.reference !== "NONREF" ? f61.reference : "");
      const name = f86.name;
      const isExpense = Number(f61.amount) < 0;

      rows.push({
        datum: f61.valueDate,
        betrag: f61.amount,
        sender: isExpense ? "" : name,
        empfaenger: isExpense ? name : "",
        verwendungszweck: [f86.bookingText, purpose]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 2000),
        iban: f86.iban,
        kundenreferenz:
          f61.reference && f61.reference !== "NONREF" ? f61.reference : "",
        bank: "sparkasse",
        konto: "Girokonto",
        balance: null,
      });
    }
  }

  flushPendingWithout86();

  if (rows.length === 0) {
    throw new ImportParseError(
      "Keine Sparkasse-Buchungen gefunden.",
      "Datei enthält :61:/:86:, aber keine verwertbaren Beträge.",
    );
  }

  return {
    konto: "Girokonto",
    accountIban: accountRef,
    balance: lastBalance,
    rows,
    warnings: warnings.length ? warnings : undefined,
    skippedRows: skippedRows || undefined,
  };
}
