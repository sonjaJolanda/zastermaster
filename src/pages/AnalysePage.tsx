import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import {
  exportAnalysisCsv,
  getAnalysisBreakdown,
  getAnalysisByCategory,
  getAnalysisSummary,
  getAnalysisTimeSeries,
  getAccounts,
  getCategories,
  getInvestedTotal,
  getTransactionFilterOptions,
  useQuery,
} from "wasp/client/operations";
import {
  AnalysisCategoryPie,
  AnalysisTrendChart,
  type ChartExportHandle,
} from "../components/AnalysisCharts";
import { AnalysisBreakdownTable } from "../components/AnalysisBreakdownTable";
import { PageTitle } from "../components/PageChrome";
import { InvestiertSummaryStat } from "../components/InvestiertSummaryStat";
import { KontostandSummaryStat } from "../components/KontostandSummaryStat";
import { downloadCsv } from "../features/export/csv";
import { buildAndDownloadAnalysisPdf } from "../features/export/analysisPdf";
import type { AnalysisTyp } from "../features/analysis/types";
import {
  DATE_PRESET_CHIPS,
  monthRange,
  rangeForPreset,
  type DatePreset,
} from "../features/dates/presets";
import {
  loadAnalyseFilters,
  saveAnalyseFilters,
} from "../features/filters/persist";
import { useClearNavPendingWhen } from "../features/shell/NavPendingContext";

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const ANALYSIS_APPROX_HINT =
  "Hinweis: Diese Zahl ist aktuell noch nicht vollständig korrekt und dient eher als grobe Orientierung.";

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

function AnalysisApproxInfo() {
  return (
    <span
      className="zm-summary-info"
      title={ANALYSIS_APPROX_HINT}
      aria-label={ANALYSIS_APPROX_HINT}
      role="img"
    >
      <Info size={12} aria-hidden />
    </span>
  );
}

export function AnalysePage() {
  const defaults = useMemo(() => {
    const month = monthRange();
    return {
      banks: [] as string[],
      konten: [] as string[],
      typ: "all" as AnalysisTyp,
      categoryId: null as number | null,
      subcategoryId: null as number | null,
      preset: "month" as DatePreset,
      dateFrom: month.from,
      dateTo: month.to,
    };
  }, []);

  const initial = useMemo(() => loadAnalyseFilters(defaults), [defaults]);

  const [preset, setPreset] = useState<DatePreset>(initial.preset);
  const [dateFrom, setDateFrom] = useState(initial.dateFrom);
  const [dateTo, setDateTo] = useState(initial.dateTo);
  const [banks, setBanks] = useState<string[]>(initial.banks);
  const [konten, setKonten] = useState<string[]>(initial.konten);
  const [typ, setTyp] = useState<AnalysisTyp>(
    (["all", "income", "expense"] as const).includes(
      initial.typ as AnalysisTyp,
    )
      ? (initial.typ as AnalysisTyp)
      : "all",
  );
  const [categoryId, setCategoryId] = useState<number | null>(
    initial.categoryId,
  );
  const [subcategoryId, setSubcategoryId] = useState<number | null>(
    initial.subcategoryId,
  );
  const [exportBusy, setExportBusy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const trendChartRef = useRef<ChartExportHandle>(null);
  const expensePieRef = useRef<ChartExportHandle>(null);
  const incomePieRef = useRef<ChartExportHandle>(null);
  const netPieRef = useRef<ChartExportHandle>(null);

  useEffect(() => {
    saveAnalyseFilters({
      banks,
      konten,
      typ,
      categoryId,
      subcategoryId,
      preset,
      dateFrom,
      dateTo,
    });
  }, [banks, konten, typ, categoryId, subcategoryId, preset, dateFrom, dateTo]);

  const { data: options } = useQuery(getTransactionFilterOptions);
  const { data: categories } = useQuery(getCategories);
  const { data: accounts } = useQuery(getAccounts);

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

  const {
    data: summary,
    isFetching: summaryFetching,
    error,
  } = useQuery(getAnalysisSummary, filterArgs);
  const { data: series, isFetching: seriesFetching } = useQuery(
    getAnalysisTimeSeries,
    filterArgs,
  );
  const { data: byCategory, isFetching: byCategoryFetching } = useQuery(
    getAnalysisByCategory,
    filterArgs,
  );
  const { data: breakdown, isFetching: breakdownFetching } = useQuery(
    getAnalysisBreakdown,
    filterArgs,
  );

  const isLoading =
    summaryFetching ||
    seriesFetching ||
    byCategoryFetching ||
    breakdownFetching;

  useClearNavPendingWhen(
    !isLoading && (summary !== undefined || error != null),
  );

  const selectedCategory = categories?.find((c) => c.id === categoryId);
  const subOptions = selectedCategory?.subcategories ?? [];

  function applyPreset(next: DatePreset) {
    setPreset(next);
    if (next === "custom" || next === "all") return;
    const r = rangeForPreset(next);
    setDateFrom(r.from);
    setDateTo(r.to);
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

  const showIncome = typ !== "expense";
  const showExpense = typ !== "income";
  const showNet = typ === "all";
  const hasData = (summary?.count ?? 0) > 0;

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

  async function handleExportPdf() {
    setExportBusy(true);
    try {
      const invested = await getInvestedTotal({
        banks: banks.length ? banks : undefined,
        konten: konten.length ? konten : undefined,
      });
      const balanceAccounts = (accounts ?? []).filter((a) => {
        if (banks.length > 0 && !banks.includes(a.bank)) return false;
        if (konten.length > 0 && !konten.includes(a.konto)) return false;
        return a.displayBalance != null;
      });
      const balanceTotal =
        balanceAccounts.length > 0
          ? balanceAccounts.reduce(
              (sum, a) => sum + Number(a.displayBalance),
              0,
            )
          : null;

      const typLabel =
        typ === "income" ? "Einnahmen" : typ === "expense" ? "Ausgaben" : "Alle";
      const catName =
        categories?.find((c) => c.id === categoryId)?.name ?? null;
      const subName =
        selectedCategory?.subcategories.find((s) => s.id === subcategoryId)
          ?.name ?? null;

      const filterLines = [
        `Zeitraum: ${dateFrom} bis ${dateTo}`,
        `Bank: ${banks.length ? banks.join(", ") : "alle"}`,
        `Konto: ${konten.length ? konten.join(", ") : "alle"}`,
        `Typ: ${typLabel}`,
        catName ? `Kategorie: ${catName}` : null,
        subName ? `Unterkategorie: ${subName}` : null,
      ].filter((x): x is string => Boolean(x));

      const metrics = [
        {
          label: "Kontostand",
          value:
            balanceTotal != null ? eur.format(balanceTotal) : "—",
        },
        {
          label: "Investiert",
          value:
            invested?.total != null
              ? eur.format(Number(invested.total))
              : "—",
        },
      ];
      if (showIncome) {
        metrics.push({
          label: "Einnahmen",
          value: eur.format(Number(summary?.income ?? 0)),
        });
      }
      if (showExpense) {
        metrics.push({
          label: "Ausgaben",
          value: eur.format(Number(summary?.expense ?? 0)),
        });
      }
      if (showNet) {
        metrics.push({
          label: "Netto",
          value: eur.format(Number(summary?.net ?? 0)),
        });
      }
      metrics.push({
        label: "Buchungen",
        value: (summary?.count ?? 0).toLocaleString("de-DE"),
      });

      await buildAndDownloadAnalysisPdf({
        metrics,
        filterLines,
        trendImage: trendChartRef.current?.toDataUrl() ?? null,
        trendAspectRatio: trendChartRef.current?.getAspectRatio() ?? null,
        expensePieImage: expensePieRef.current?.toDataUrl() ?? null,
        incomePieImage: incomePieRef.current?.toDataUrl() ?? null,
        netPieImage: netPieRef.current?.toDataUrl() ?? null,
        expensePieAspectRatio: expensePieRef.current?.getAspectRatio() ?? null,
        incomePieAspectRatio: incomePieRef.current?.getAspectRatio() ?? null,
        netPieAspectRatio: netPieRef.current?.getAspectRatio() ?? null,
        expenseBreakdown: breakdown?.expenses ?? [],
        incomeBreakdown: breakdown?.income ?? [],
        netBreakdown: breakdown?.net ?? [],
        showExpense,
        showIncome,
        showNet,
      });
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "PDF-Export fehlgeschlagen.",
      );
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <section className="zm-analyse-page">
      <PageTitle icon="/design/Analysis.svg">Analyse</PageTitle>

      <div className="zm-tx-topbar" aria-live="polite">
        <div className="zm-summary-inline">
          <KontostandSummaryStat banks={banks} konten={konten} />
          <InvestiertSummaryStat banks={banks} konten={konten} />
          {showIncome && (
            <div>
              <span className="zm-summary-label zm-summary-label-with-info">
                Einnahmen <AnalysisApproxInfo />
              </span>
              <span className="zm-amount-income">
                {eur.format(Number(summary?.income ?? 0))}
              </span>
            </div>
          )}
          {showExpense && (
            <div>
              <span className="zm-summary-label zm-summary-label-with-info">
                Ausgaben <AnalysisApproxInfo />
              </span>
              <span className="zm-amount-expense">
                {eur.format(Number(summary?.expense ?? 0))}
              </span>
            </div>
          )}
          {showNet && (
            <div>
              <span className="zm-summary-label zm-summary-label-with-info">
                Netto <AnalysisApproxInfo />
              </span>
              <span
                className={
                  Number(summary?.net ?? 0) > 0
                    ? "zm-amount-income"
                    : Number(summary?.net ?? 0) < 0
                      ? "zm-amount-expense"
                      : "zm-summary-value"
                }
              >
                {eur.format(Number(summary?.net ?? 0))}
              </span>
            </div>
          )}
          <div>
            <span className="zm-summary-label">Buchungen</span>
            <span className="zm-summary-value">
              {(summary?.count ?? 0).toLocaleString("de-DE")}
            </span>
          </div>
        </div>
        <div className="zm-tx-topbar-actions">
          <button
            type="button"
            className="zm-btn zm-btn-ghost zm-btn-with-icon"
            disabled={exportBusy || isLoading}
            onClick={() => void handleExportCsv()}
            aria-label="CSV exportieren"
          >
            <img
              src="/design/Export.svg"
              alt=""
              className="zm-btn-export"
              aria-hidden
            />
            CSV
          </button>
          <button
            type="button"
            className="zm-btn zm-btn-ghost zm-btn-with-icon"
            disabled={exportBusy || isLoading}
            onClick={() => void handleExportPdf()}
            aria-label="PDF exportieren"
          >
            <img
              src="/design/Export.svg"
              alt=""
              className="zm-btn-export"
              aria-hidden
            />
            PDF
          </button>
          <button
            type="button"
            className="zm-btn zm-btn-ghost"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((o) => !o)}
          >
            {filtersOpen ? (
              <ChevronUp size={16} aria-hidden />
            ) : (
              <ChevronDown size={16} aria-hidden />
            )}{" "}
            Filter
          </button>
        </div>
      </div>

      <div
        className={`zm-toolbar zm-analyse-filters${filtersOpen ? "" : " is-collapsed"}`}
      >
        <div className="zm-filter-group">
          <span className="zm-field-label">Zeitraum</span>
          <div className="zm-chip-row">
            {DATE_PRESET_CHIPS.filter((c) => c.analyse).map(({ key, label }) => (
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

      {isLoading && (
        <div
          className="zm-analyse-loading"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="zm-related-spinner" aria-hidden />
          <p>Auswertung wird geladen…</p>
        </div>
      )}
      {!isLoading && error && (
        <p className="zm-status-error" role="alert">
          {String(error)}
        </p>
      )}

      {!isLoading && !hasData && summary && (
        <p className="zm-page-lead">
          Keine Buchungen im gewählten Zeitraum. Zeitraum anpassen oder Daten
          importieren.
        </p>
      )}

      {!isLoading && hasData && (
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
              ref={trendChartRef}
              labels={(series?.points ?? []).map((p) => p.label)}
              income={(series?.points ?? []).map((p) => Number(p.income))}
              expense={(series?.points ?? []).map((p) => Number(p.expense))}
              showIncome={showIncome}
              showExpense={showExpense}
            />
          </section>

          {(showExpense || showIncome || showNet) && (
            <div
              className={`zm-analyse-pies${showExpense && showIncome && showNet ? " zm-analyse-pies--triple" : ""}`}
            >
              {showNet && (
                <section className="zm-analyse-section">
                  <h2 className="zm-analyse-heading">
                    Total nach{" "}
                    {byCategory?.mode === "subcategory"
                      ? "Unterkategorie"
                      : "Kategorie"}
                    {" "}
                    <AnalysisApproxInfo />
                  </h2>
                  <AnalysisCategoryPie
                    ref={netPieRef}
                    slices={byCategory?.net ?? []}
                    emptyLabel="Kein Netto in diesem Filter."
                    onSliceClick={
                      subcategoryId == null ? drillToCategory : undefined
                    }
                  />
                </section>
              )}
              {showExpense && (
                <section className="zm-analyse-section">
                  <h2 className="zm-analyse-heading">
                    Ausgaben nach{" "}
                    {byCategory?.mode === "subcategory"
                      ? "Unterkategorie"
                      : "Kategorie"}
                    {" "}
                    <AnalysisApproxInfo />
                  </h2>
                  <AnalysisCategoryPie
                    ref={expensePieRef}
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
                    {" "}
                    <AnalysisApproxInfo />
                  </h2>
                  <AnalysisCategoryPie
                    ref={incomePieRef}
                    slices={byCategory?.income ?? []}
                    emptyLabel="Keine Einnahmen in diesem Filter."
                    onSliceClick={
                      subcategoryId == null ? drillToCategory : undefined
                    }
                  />
                </section>
              )}
            </div>
          )}

          {showNet && (
            <AnalysisBreakdownTable
              title={
                <>
                  Total-Aufschlüsselung <AnalysisApproxInfo />
                </>
              }
              rows={breakdown?.net ?? []}
              emptyLabel="Kein Netto zum Aufschlüsseln."
              signedAmounts
              onCategoryClick={
                byCategory?.mode === "category" ? drillToCategory : undefined
              }
            />
          )}

          {showExpense && (
            <AnalysisBreakdownTable
              title={
                <>
                  Ausgaben-Aufschlüsselung <AnalysisApproxInfo />
                </>
              }
              rows={breakdown?.expenses ?? []}
              emptyLabel="Keine Ausgaben zum Aufschlüsseln."
              onCategoryClick={
                byCategory?.mode === "category" ? drillToCategory : undefined
              }
            />
          )}

          {showIncome && (
            <AnalysisBreakdownTable
              title={
                <>
                  Einnahmen-Aufschlüsselung <AnalysisApproxInfo />
                </>
              }
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
