import { Info } from "lucide-react";

export const SUMMARY_APPROX_HINT =
  "Hinweis: Diese Zahl ist aktuell noch nicht vollständig korrekt und dient eher als grobe Orientierung.";

/** Info-(i) for Einnahmen / Ausgaben / Netto (Analyse + Transaktionen). */
export function SummaryApproxInfo() {
  return (
    <span
      className="zm-summary-info"
      title={SUMMARY_APPROX_HINT}
      aria-label={SUMMARY_APPROX_HINT}
      role="img"
    >
      <Info size={12} aria-hidden />
    </span>
  );
}
