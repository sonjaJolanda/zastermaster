import { Info } from "lucide-react";
import { getInvestedTotal, useQuery } from "wasp/client/operations";

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const INFO =
  "Bestätigter Kapitaleinsatz (EK), nicht Marktwert. Zählt nicht in Ausgaben/Einnahmen — Vermögensumschichtung, kein Konsum. So bleiben Sparen & Analyse ohne Doppelzählung.";

/** Confirmed investment cost basis (EK); independent of TX/Analyse filters. */
export function InvestiertSummaryStat() {
  const { data } = useQuery(getInvestedTotal);
  const total = data?.total;
  const count = data?.count ?? 0;

  const title =
    count === 0
      ? "Noch keine bestätigten Investitionen — unter Transaktionen „Investitionen erkennen“."
      : `${INFO} Aus ${count} Buchung(en).`;

  return (
    <div title={title}>
      <span className="zm-summary-label zm-summary-label-with-info">
        Investiert
        <span
          className="zm-summary-info"
          title={INFO}
          aria-label={INFO}
          role="img"
        >
          <Info size={12} aria-hidden />
        </span>
      </span>
      <span className="zm-summary-value">
        {total != null ? eur.format(Number(total)) : "—"}
      </span>
    </div>
  );
}
