import { useMemo, useState } from "react";
import {
  exportAnalysisCsv,
  getAnalysisBreakdown,
  getAnalysisByCategory,
  getAnalysisSummary,
  getAnalysisTimeSeries,
  getCategories,
  getTransactionFilterOptions,
  useQuery,
} from "wasp/client/operations";
import {
  AnalysisCategoryPie,
  AnalysisTrendChart,
} from "../components/AnalysisCharts";
import { AnalysisBreakdownTable } from "../components/AnalysisBreakdownTable";
import { downloadCsv } from "../features/export/csv";
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
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [subcategoryId, setSubcategoryId] = useState<number | null>(null);
  const [exportBusy, setExportBusy] = useState(false);

  const { data: options } = useQuery(getTransactionFilterOptions);
  const { data: categories } = useQuery(getCategories);

  const filterArgs = useMemo(
    () => ({
      dateFrom,
      dateTo,
      banks: banks.length ? banks : undefined,
      konten: konten.length ? konten : undefined,
      typ,
      categoryId: categoryId ?? undefined,
      subcategoryId: subcategoryId ?? undefined,
    }),
    [dateFrom, dateTo, banks, konten, typ, categoryId, subcategoryId],
  );

  const { data: summary, isLoading, error } = useQuery(
    getAnalysisSummary,
    filterArgs,
  );
  const { data: series } = useQuery(getAnalysisTimeSeries, filterArgs);
  const { data: byCategory } = useQuery(getAnalysisByCategory, filterArgs);
  const { data: breakdown } = useQuery(getAnalysisBreakdown, filterArgs);

  const selectedCategory = categories?.find((c) => c.id === categoryId);
  const subOptions = selectedCategory?.subcategories ?? [];

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

  function drillToCategory(id: number | null) {
    if (id == null) return;
    if (byCategory?.mode === "category") {
      setCategoryId(id);
      setSubcategoryId(null);
    } else {
      setSubcategoryId(id);
    }
  }

  async function handleExportCsv() {
    setExportBusy(true);
    try {
      const result = await exportAnalysisCsv(filterArgs);
      downloadCsv(result.fileName, result.csv);
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "Export fehlgeschlagen.",
      );
    } finally {
      setExportBusy(false);
    }
  }

  const showIncome = typ !== "expense";
  const showExpense = typ !== "income";
  const showNet = typ === "all";
  const hasData = (summary?.count ?? 0) > 0;

  return (
    <section className="zm-analyse-page">
      <h1 className="zm-page-title">Analyse</h1>
      <p className="zm-page-lead">
        Zeitraum-Auswertung mit Trend, Kategorien und Aufschlüsselung
        (verwandte Buchungen werden genettet).
      </p>

      <div className="zm-toolbar zm-analyse-filters">
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

        <label className="zm-field zm-field-inline">
          <span className="zm-field-label">Kategorie</span>
          <select
            className="zm-select"
            value={categoryId ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              setCategoryId(v ? Number(v) : null);
              setSubcategoryId(null);
            }}
          >
            <option value="">Alle</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        {categoryId != null && (
          <label className="zm-field zm-field-inline">
            <span className="zm-field-label">Unterkategorie</span>
            <select
              className="zm-select"
              value={subcategoryId ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                setSubcategoryId(v ? Number(v) : null);
              }}
            >
              <option value="">Alle</option>
              {subOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {(categoryId != null || subcategoryId != null) && (
          <button
            type="button"
            className="zm-btn zm-btn-ghost"
            onClick={() => {
              setCategoryId(null);
              setSubcategoryId(null);
            }}
          >
            Kategorie zurücksetzen
          </button>
        )}

        <button
          type="button"
          className="zm-btn zm-btn-ghost"
          disabled={exportBusy || isLoading}
          onClick={() => void handleExportCsv()}
        >
          {exportBusy ? "Export…" : "CSV exportieren"}
        </button>
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

      {!hasData && !isLoading && summary && (
        <p className="zm-page-lead">
          Keine Buchungen im gewählten Zeitraum. Zeitraum anpassen oder Daten
          importieren.
        </p>
      )}

      {hasData && (
        <>
          <section className="zm-analyse-section">
            <h2 className="zm-analyse-heading">
              Zeitlicher Trend
              {series?.grouping
                ? ` (${
                    series.grouping === "day"
                      ? "Tage"
                      : series.grouping === "month"
                        ? "Monate"
                        : "Jahre"
                  })`
                : ""}
            </h2>
            <AnalysisTrendChart
              labels={(series?.points ?? []).map((p) => p.label)}
              income={(series?.points ?? []).map((p) => Number(p.income))}
              expense={(series?.points ?? []).map((p) => Number(p.expense))}
              showIncome={showIncome}
              showExpense={showExpense}
            />
          </section>

          {showExpense && (
            <section className="zm-analyse-section">
              <h2 className="zm-analyse-heading">
                Ausgaben nach{" "}
                {byCategory?.mode === "subcategory"
                  ? "Unterkategorie"
                  : "Kategorie"}
              </h2>
              <AnalysisCategoryPie
                slices={byCategory?.expenses ?? []}
                emptyLabel="Keine Ausgaben in diesem Filter."
                onSliceClick={
                  subcategoryId == null ? drillToCategory : undefined
                }
              />
            </section>
          )}

          {showIncome && (
            <section className="zm-analyse-section">
              <h2 className="zm-analyse-heading">
                Einnahmen nach{" "}
                {byCategory?.mode === "subcategory"
                  ? "Unterkategorie"
                  : "Kategorie"}
              </h2>
              <AnalysisCategoryPie
                slices={byCategory?.income ?? []}
                emptyLabel="Keine Einnahmen in diesem Filter."
                onSliceClick={
                  subcategoryId == null ? drillToCategory : undefined
                }
              />
            </section>
          )}

          {showExpense && (
            <AnalysisBreakdownTable
              title="Ausgaben-Aufschlüsselung"
              rows={breakdown?.expenses ?? []}
              emptyLabel="Keine Ausgaben zum Aufschlüsseln."
              onCategoryClick={
                byCategory?.mode === "category" ? drillToCategory : undefined
              }
            />
          )}

          {showIncome && (
            <AnalysisBreakdownTable
              title="Einnahmen-Aufschlüsselung"
              rows={breakdown?.income ?? []}
              emptyLabel="Keine Einnahmen zum Aufschlüsseln."
              onCategoryClick={
                byCategory?.mode === "category" ? drillToCategory : undefined
              }
            />
          )}
        </>
      )}
    </section>
  );
}
