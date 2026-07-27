import { getAccounts, useQuery } from "wasp/client/operations";

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

type Props = {
  /** Active bank filters (empty = all). */
  banks?: string[];
  /** Active konto filters (empty = all). */
  konten?: string[];
};

/** Calibrated wealth (roll-forward), scoped to selected bank/konto filters. */
export function KontostandSummaryStat({
  banks = [],
  konten = [],
}: Props) {
  const { data: accounts } = useQuery(getAccounts);

  const filtered = (accounts ?? []).filter((a) => {
    if (banks.length > 0 && !banks.includes(a.bank)) return false;
    if (konten.length > 0 && !konten.includes(a.konto)) return false;
    return true;
  });

  const calibrated = filtered.filter((a) => a.displayBalance != null);
  const total =
    calibrated.length > 0
      ? calibrated.reduce((sum, a) => sum + Number(a.displayBalance), 0)
      : null;
  const partial =
    filtered.length > 0 &&
    calibrated.length > 0 &&
    calibrated.length < filtered.length;
  const filteredScope = banks.length > 0 || konten.length > 0;

  const title =
    accounts == null || accounts.length === 0
      ? "Noch keine Konten — zuerst importieren und kalibrieren."
      : filtered.length === 0
        ? "Keine Konten passen zu den gewählten Filtern."
        : total == null
          ? "Noch kein Kontostand — unter Einstellungen kalibrieren."
          : [
              filteredScope
                ? `Summe der gefilterten Konten (${calibrated.length}/${filtered.length} kalibriert).`
                : partial
                  ? `Summe aus ${calibrated.length} von ${filtered.length} kalibrierten Konten (roll-forward).`
                  : "Summe aller kalibrierten Konten (roll-forward).",
              ...calibrated.map(
                (a) =>
                  `${a.bank.toUpperCase()} · ${a.konto}: ${eur.format(Number(a.displayBalance))}`,
              ),
            ].join("\n");

  return (
    <div title={title}>
      <span className="zm-summary-label">Kontostand</span>
      <span className="zm-summary-value">
        {total != null ? eur.format(total) : "—"}
      </span>
    </div>
  );
}
