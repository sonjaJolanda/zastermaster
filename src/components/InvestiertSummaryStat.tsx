import { Info } from "lucide-react";
import { getInvestedTotal, useQuery } from "wasp/client/operations";

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const INFO =
  "Bestätigter Kapitaleinsatz (EK) im gewählten Zeitraum, nicht Marktwert. Zusätzlich zu den normalen Ausgaben/Einnahmen — die Buchungen bleiben in den Summen und Charts.";

type Props = {
  banks?: string[];
  konten?: string[];
  dateFrom?: string;
  dateTo?: string;
};

/** Confirmed investment cost basis (EK), scoped to bank/konto and Zeitraum. */
export function InvestiertSummaryStat({
  banks = [],
  konten = [],
  dateFrom,
  dateTo,
}: Props) {
  const queryArgs = {
    banks: banks.length ? banks : undefined,
    konten: konten.length ? konten : undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };
  const { data } = useQuery(getInvestedTotal, queryArgs);
  const total = data?.total;
  const count = data?.count ?? 0;
  const filteredScope =
    banks.length > 0 || konten.length > 0 || Boolean(dateFrom || dateTo);

  const title =
    count === 0
      ? filteredScope
        ? "Keine bestätigten Investitionen für die gewählten Filter."
        : "Noch keine bestätigten Investitionen — unter Transaktionen „Investitionen erkennen“."
      : `${INFO} Aus ${count} Buchung(en)${filteredScope ? " (gefiltert)" : ""}.`;

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
