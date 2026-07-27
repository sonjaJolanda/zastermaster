import { describe, expect, it } from "vitest";
import { parseDkbCsv } from "./dkb";
import { parsePaypalTxt } from "./paypal";
import { parseSparkasseMt940 } from "./sparkasse";
import { parseTradeRepublicCsv } from "./traderepublic";
import { dkbSampleCsv } from "./__fixtures__/dkb";
import { paypalSampleTxt } from "./__fixtures__/paypal";
import { sparkasseSampleMt940 } from "./__fixtures__/sparkasse";
import { tradeRepublicSampleCsv } from "./__fixtures__/traderepublic";

describe("parseDkbCsv", () => {
  it("parses gebuchte rows and skips non-Gebucht", () => {
    const result = parseDkbCsv(dkbSampleCsv);
    expect(result.konto).toBe("Girokonto");
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]!.betrag).toBe("-12.34");
    expect(result.rows[1]!.betrag).toBe("100.00");
    expect(result.skippedRows).toBeGreaterThanOrEqual(1);
  });

  it("handles BOM", () => {
    const result = parseDkbCsv(`\uFEFF${dkbSampleCsv}`);
    expect(result.rows.length).toBe(2);
  });

  it("parses DKB amounts with thousands separators", () => {
    const csv = [
      "Girokonto;DE00120300001234567890",
      "",
      "Kontostand vom 25.07.2026:;12.345,67",
      "",
      "Buchungsdatum;Wertstellung;Status;Zahlungspflichtige*r;Zahlungsempfänger*in;Verwendungszweck;Umsatztyp;IBAN;Betrag (€);Gläubiger-ID;Mandatsreferenz;Kundenreferenz",
      "24.07.2026;24.07.2026;Gebucht;Arbeitgeber;Alice;Bonus;Eingang;DE00999999999999999999;1.234,56;;;REF1",
    ].join("\n");

    const result = parseDkbCsv(csv);
    expect(result.balance).toBe("12345.67");
    expect(result.rows[0]!.betrag).toBe("1234.56");
  });
});

describe("parsePaypalTxt", () => {
  it("imports Abgeschlossen EUR only", () => {
    const result = parsePaypalTxt(paypalSampleTxt);
    expect(result.konto).toBe("PayPal");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.betrag).toBe("-25.00");
    expect(result.rows[0]!.kundenreferenz).toBe("TXN1");
  });
});

describe("parseSparkasseMt940", () => {
  it("parses :61:/:86: pair", () => {
    const result = parseSparkasseMt940(sparkasseSampleMt940);
    expect(result.rows.length).toBeGreaterThanOrEqual(1);
    expect(result.rows[0]!.bank).toBe("sparkasse");
    expect(Number(result.rows[0]!.betrag)).not.toBe(0);
  });
});

describe("parseTradeRepublicCsv", () => {
  it("parses EUR cash rows", () => {
    const result = parseTradeRepublicCsv(tradeRepublicSampleCsv);
    expect(result.konto).toBe("Trade Republic");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.betrag).toBe("-9.99");
  });

  it("skips non-EUR", () => {
    const withEur =
      "date,amount,fee,tax,currency,description,name,type,transaction_id\n" +
      "2026-07-01T10:00:00Z,-5.00,0,0,EUR,Coffee,Cafe,CARD,tx1\n" +
      "2026-07-02T10:00:00Z,-1.00,0,0,USD,Skip,X,CARD,tx2\n";
    const result = parseTradeRepublicCsv(withEur);
    expect(result.rows).toHaveLength(1);
    expect(result.skippedRows).toBe(1);
  });
});
