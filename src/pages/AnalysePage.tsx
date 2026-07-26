import { useMemo, useState } from "react";
import {
  getAnalysisSummary,
  getTransactionFilterOptions,
  useQuery,
} from "wasp/client/operations";
import type { AnalysisTyp } from "../features/analysis/types";

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

type Preset = "year" | "month" | "custom";

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yearStart(year: number): string {
  return `${year}-01-01`;
}

function monthRange(now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const from = new Date(y, m, 1);
  const to = new Date();
  return { from: isoDate(from), to: isoDate(to) };
}

function defaultYearRange(now = new Date()): { from: string; to: string } {
  return { from: yearStart(now.getFullYear()), to: isoDate(now) };
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export function AnalysePage() {
  const initial = defaultYearRange();
  const [preset, setPreset] = useState<Preset>("year");
  const [dateFrom, setDateFrom] = useState(initial.from);
  const [dateTo, setDateTo] = useState(initial.to);
  const [banks, setBanks] = useState<string[]>([]);
  const [konten, setKonten] = useState<string[]>([]);
  const [typ, setTyp] = useState<AnalysisTyp>("all");

  const { data: options } = useQuery(getTransactionFilterOptions);

  const filterArgs = useMemo(
    () => ({
      dateFrom,
      dateTo,
      banks: banks.length ? banks : undefined,
      konten: konten.length ? konten : undefined,
      typ,
    }),
    [dateFrom, dateTo, banks, konten, typ],
  );

  const { data: summary, isLoading, error } = useQuery(
    getAnalysisSummary,
    filterArgs,
  );

  function applyPreset(next: Preset) {
    setPreset(next);
    if (next === "year") {
      const r = defaultYearRange();
      setDateFrom(r.from);
      setDateTo(r.to);
    } else if (next === "month") {
      const r = monthRange();
      setDateFrom(r.from);
      setDateTo(r.to);
    }
  }

  const showIncome = typ !== "expense";
  const showExpense = typ !== "income";
  const showNet = typ === "all";

  return (
    <section>
      <h1 className="zm-page-title">Analyse</h1>
      <p className="zm-page-lead">
        Zeitraum-Auswertung (Diagramme folgen später).
      </p>

      <div className="zm-toolbar">
        <div className="zm-filter-group">
          <span className="zm-field-label">Zeitraum</span>
          <div className="zm-chip-row">
            {(
              [
                ["year", "Dieses Jahr"],
                ["month", "Dieser Monat"],
                ["custom", "Benutzerdefiniert"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`zm-chip${preset === key ? " is-active" : ""}`}
                onClick={() => applyPreset(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <label className="zm-field zm-field-inline">
          <span className="zm-field-label">Von</span>
          <input
            className="zm-input"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setPreset("custom");
              setDateFrom(e.target.value);
            }}
          />
        </label>
        <label className="zm-field zm-field-inline">
          <span className="zm-field-label">Bis</span>
          <input
            className="zm-input"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setPreset("custom");
              setDateTo(e.target.value);
            }}
          />
        </label>

        <label className="zm-field zm-field-inline">
          <span className="zm-field-label">Typ</span>
          <select
            className="zm-select"
            value={typ}
            onChange={(e) => setTyp(e.target.value as AnalysisTyp)}
          >
            <option value="all">Alle</option>
            <option value="expense">Ausgaben</option>
            <option value="income">Einnahmen</option>
          </select>
        </label>
      </div>

      <div className="zm-toolbar">
        <div className="zm-filter-group">
          <span className="zm-field-label">Bank</span>
          <div className="zm-chip-row">
            {(options?.banks ?? []).map((bank) => {
              const active = banks.includes(bank);
              return (
                <button
                  key={bank}
                  type="button"
                  className={`zm-chip${active ? " is-active" : ""}`}
                  onClick={() => setBanks((prev) => toggleValue(prev, bank))}
                >
                  {bank.toUpperCase()}
                </button>
              );
            })}
            {(options?.banks?.length ?? 0) === 0 && (
              <span className="zm-page-lead">—</span>
            )}
          </div>
        </div>
        <div className="zm-filter-group">
          <span className="zm-field-label">Konto</span>
          <div className="zm-chip-row">
            {(options?.konten ?? []).map((konto) => {
              const active = konten.includes(konto);
              return (
                <button
                  key={konto}
                  type="button"
                  className={`zm-chip${active ? " is-active" : ""}`}
                  onClick={() => setKonten((prev) => toggleValue(prev, konto))}
                >
                  {konto}
                </button>
              );
            })}
            {(options?.konten?.length ?? 0) === 0 && (
              <span className="zm-page-lead">—</span>
            )}
          </div>
        </div>
      </div>

      {isLoading && <p className="zm-page-lead">Laden…</p>}
      {error && (
        <p className="zm-status-error" role="alert">
          {String(error)}
        </p>
      )}

      {summary && !isLoading && (
        <div className="zm-summary-strip" aria-live="polite">
          {showIncome && (
            <div>
              <span className="zm-summary-label">Einnahmen</span>
              <span className="zm-amount-income">
                {eur.format(Number(summary.income))}
              </span>
            </div>
          )}
          {showExpense && (
            <div>
              <span className="zm-summary-label">Ausgaben</span>
              <span className="zm-amount-expense">
                {eur.format(Number(summary.expense))}
              </span>
            </div>
          )}
          {showNet && (
            <div>
              <span className="zm-summary-label">Netto</span>
              <span
                className={
                  Number(summary.net) > 0
                    ? "zm-amount-income"
                    : Number(summary.net) < 0
                      ? "zm-amount-expense"
                      : "zm-summary-value"
                }
              >
                {eur.format(Number(summary.net))}
              </span>
            </div>
          )}
          <div>
            <span className="zm-summary-label">Buchungen</span>
            <span className="zm-summary-value">
              {summary.count.toLocaleString("de-DE")}
            </span>
          </div>
        </div>
      )}

      {summary && summary.count === 0 && !isLoading && (
        <p className="zm-page-lead">
          Keine Buchungen im gewählten Zeitraum. Zeitraum anpassen oder Daten
          importieren.
        </p>
      )}
    </section>
  );
}
