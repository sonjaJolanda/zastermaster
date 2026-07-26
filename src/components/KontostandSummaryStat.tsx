import { getHeaderBalance, useQuery } from "wasp/client/operations";

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

/** Calibrated wealth (roll-forward); independent of TX/Analyse filters. */
export function KontostandSummaryStat() {
  const { data } = useQuery(getHeaderBalance);
  const total = data?.total;
  const partial =
    data != null &&
    data.accountCount > 0 &&
    data.calibratedCount > 0 &&
    data.calibratedCount < data.accountCount;

  const title =
    data == null || data.accountCount === 0
      ? "Noch keine Konten — zuerst importieren und kalibrieren."
      : data.total == null
        ? "Noch kein Kontostand — unter Einstellungen kalibrieren."
        : partial
          ? `Summe aus ${data.calibratedCount} von ${data.accountCount} kalibrierten Konten (roll-forward).`
          : "Summe aller kalibrierten Konten (roll-forward).";

  return (
    <div title={title}>
      <span className="zm-summary-label">Kontostand</span>
      <span className="zm-summary-value">
        {total != null ? eur.format(Number(total)) : "—"}
      </span>
    </div>
  );
}
