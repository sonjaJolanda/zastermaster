/** Synthetic DKB CSV — no real account data. */
export const dkbSampleCsv = [
  "Girokonto;DE00120300001234567890",
  "",
  "Kontostand vom 25.07.2026:;1.000,00",
  "",
  "Buchungsdatum;Wertstellung;Status;Zahlungspflichtige*r;Zahlungsempfänger*in;Verwendungszweck;Umsatztyp;IBAN;Betrag (€);Gläubiger-ID;Mandatsreferenz;Kundenreferenz",
  "24.07.2026;24.07.2026;Gebucht;Alice;REWE;Einkauf;Ausgang;DE00120300001234567890;-12,34;;;REF1",
  "23.07.2026;23.07.2026;Vorgemerkt;Alice;Amazon;Pending;Ausgang;DE00120300001234567890;-50,00;;;REF2",
  "22.07.2026;22.07.2026;Gebucht;Arbeitgeber;Alice;Gehalt;Eingang;DE00999999999999999999;100,00;;;REF3",
].join("\n");
