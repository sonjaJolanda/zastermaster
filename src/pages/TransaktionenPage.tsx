import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Link2 } from "lucide-react";
import {
  exportTransactionsCsv,
  exportTransactionsForPdf,
  getAccounts,
  getCategories,
  getInvestedTotal,
  getTransactionFilterOptions,
  getTransactionNav,
  getTransactions,
  getTransactionsSummary,
  useQuery,
} from "wasp/client/operations";
import { EditIconButton, PageTitle } from "../components/PageChrome";
import { InvestiertSummaryStat } from "../components/InvestiertSummaryStat";
import { KontostandSummaryStat } from "../components/KontostandSummaryStat";
import { SummaryApproxInfo } from "../components/SummaryApproxInfo";
import { InvestmentDetectOverlay } from "../components/InvestmentDetectOverlay";
import { RelatedDetectOverlay } from "../components/RelatedDetectOverlay";
import { TransactionDetailsOverlay } from "../components/TransactionDetailsOverlay";
import { downloadCsv } from "../features/export/csv";
import { buildAndDownloadTransactionsPdf } from "../features/export/transactionsPdf";
import { PDF_TX_MAX_ROWS } from "../features/export/pdfConstants";
import {
  DATE_PRESET_CHIPS,
  monthRange,
  rangeForPreset,
  type DatePreset,
} from "../features/dates/presets";
import {
  loadTxFilters,
  saveTxFilters,
} from "../features/filters/persist";
import { useClearNavPendingWhen } from "../features/shell/NavPendingContext";
import {
  bankBadgeClass,
  bankBadgeColor,
  bankLabel,
  kontoPillClass,
} from "../features/transactions/badges";
import {
  loadColumnVisibility,
  saveColumnVisibility,
  type ColumnVisibility,
} from "../features/transactions/columnVisibility";
import type { TransactionListItem } from "../features/transactions/types";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  TX_COLUMN_DEFS,
  type CategorySourceFilter,
  type TransactionTyp,
  type TxColumnKey,
} from "../features/transactions/types";

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

const dateDe = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

const SOURCE_LABEL: Record<TransactionListItem["categorySource"], string> = {
  manual: "Manuell",
  learned: "Gelernt",
  keyword: "Stichwort",
  none: "Keine",
};

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

export function TransaktionenPage() {
  const defaults = useMemo(() => {
    const month = monthRange();
    return {
      banks: [] as string[],
      konten: [] as string[],
      typ: "all" as TransactionTyp,
      categorySource: "all" as CategorySourceFilter,
      categoryId: null as number | null,
      subcategoryId: null as number | null,
      includeBalanceAdjustments: false,
      preset: "month" as DatePreset,
      dateFrom: month.from,
      dateTo: month.to,
      search: "",
      pageSize: DEFAULT_PAGE_SIZE,
    };
  }, []);

  const initial = useMemo(() => loadTxFilters(defaults), [defaults]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(initial.pageSize);
  const [banks, setBanks] = useState<string[]>(initial.banks);
  const [konten, setKonten] = useState<string[]>(initial.konten);
  const [typ, setTyp] = useState<TransactionTyp>(
    (["all", "income", "expense"] as const).includes(
      initial.typ as TransactionTyp,
    )
      ? (initial.typ as TransactionTyp)
      : "all",
  );
  const [categorySource, setCategorySource] = useState<CategorySourceFilter>(
    (
      ["all", "manual", "learned", "keyword", "none"] as const
    ).includes(initial.categorySource as CategorySourceFilter)
      ? (initial.categorySource as CategorySourceFilter)
      : "all",
  );
  const [categoryId, setCategoryId] = useState<number | null>(
    initial.categoryId,
  );
  const [subcategoryId, setSubcategoryId] = useState<number | null>(
    initial.subcategoryId,
  );
  const [includeBalanceAdjustments, setIncludeBalanceAdjustments] =
    useState(initial.includeBalanceAdjustments);
  const [preset, setPreset] = useState<DatePreset>(initial.preset);
  const [dateFrom, setDateFrom] = useState(initial.dateFrom);
  const [dateTo, setDateTo] = useState(initial.dateTo);
  const [searchInput, setSearchInput] = useState(initial.search);
  const [search, setSearch] = useState(initial.search);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnVisibility>(() =>
    typeof window !== "undefined"
      ? loadColumnVisibility()
      : (Object.fromEntries(
          TX_COLUMN_DEFS.map((c) => [c.key, c.defaultVisible]),
        ) as ColumnVisibility),
  );
  const [selected, setSelected] = useState<TransactionListItem | null>(null);
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [investmentOpen, setInvestmentOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [pendingNavId, setPendingNavId] = useState<number | null>(null);
  const [navBusy, setNavBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const highlightTimer = useRef<number | null>(null);
  const pendingNavAnchorY = useRef<number | null>(null);
  const columnsPanelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    saveTxFilters({
      banks,
      konten,
      typ,
      categorySource,
      categoryId,
      subcategoryId,
      includeBalanceAdjustments,
      preset,
      dateFrom,
      dateTo,
      search: searchInput,
      pageSize,
    });
  }, [
    banks,
    konten,
    typ,
    categorySource,
    categoryId,
    subcategoryId,
    includeBalanceAdjustments,
    preset,
    dateFrom,
    dateTo,
    searchInput,
    pageSize,
  ]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearch((prev) => {
        const next = searchInput.trim();
        if (prev !== next) setPage(1);
        return next;
      });
    }, 300);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (!columnsOpen) return;
    function onDocClick(e: MouseEvent) {
      if (
        columnsPanelRef.current &&
        !columnsPanelRef.current.contains(e.target as Node)
      ) {
        setColumnsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [columnsOpen]);

  const filterArgs = useMemo(
    () => ({
      page,
      pageSize,
      banks: banks.length ? banks : undefined,
      konten: konten.length ? konten : undefined,
      typ,
      categorySource,
      includeBalanceAdjustments,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      search: search || undefined,
      categoryId: categoryId ?? undefined,
      subcategoryId: subcategoryId ?? undefined,
    }),
    [
      page,
      pageSize,
      banks,
      konten,
      typ,
      categorySource,
      includeBalanceAdjustments,
      dateFrom,
      dateTo,
      search,
      categoryId,
      subcategoryId,
    ],
  );

  const summaryArgs = useMemo(
    () => ({
      banks: banks.length ? banks : undefined,
      konten: konten.length ? konten : undefined,
      typ,
      categorySource,
      includeBalanceAdjustments,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      search: search || undefined,
      categoryId: categoryId ?? undefined,
      subcategoryId: subcategoryId ?? undefined,
    }),
    [
      banks,
      konten,
      typ,
      categorySource,
      includeBalanceAdjustments,
      dateFrom,
      dateTo,
      search,
      categoryId,
      subcategoryId,
    ],
  );

  const { data: options } = useQuery(getTransactionFilterOptions);
  const { data: categories } = useQuery(getCategories);
  const { data: accounts } = useQuery(getAccounts);
  const { data, isLoading, isFetching, error, refetch } = useQuery(
    getTransactions,
    filterArgs,
  );
  const { data: summary } = useQuery(getTransactionsSummary, summaryArgs);

  // Prefer isFetching so cached pages still show the route overlay while refetching.
  useClearNavPendingWhen(!isFetching && (data !== undefined || error != null));

  const items = data?.items ?? [];
  const accountColorByKey = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of accounts ?? []) {
      m.set(`${a.bank}\0${a.konto}`, a.color);
    }
    return m;
  }, [accounts]);
  const show = (key: TxColumnKey) => columns[key];

  const selectedCategory = categories?.find((c) => c.id === categoryId);
  const subOptions = selectedCategory?.subcategories ?? [];

  function resetPage() {
    setPage(1);
  }

  function applyPreset(next: DatePreset) {
    setPreset(next);
    resetPage();
    if (next === "custom") return;
    if (next === "all") {
      setDateFrom("");
      setDateTo("");
      return;
    }
    const r = rangeForPreset(next);
    setDateFrom(r.from);
    setDateTo(r.to);
  }

  function setColumn(key: TxColumnKey, visible: boolean) {
    setColumns((prev) => {
      const next = { ...prev, [key]: visible };
      saveColumnVisibility(next);
      return next;
    });
  }

  function flashHighlight(id: number) {
    setHighlightId(id);
    if (highlightTimer.current != null) {
      window.clearTimeout(highlightTimer.current);
    }
    highlightTimer.current = window.setTimeout(() => {
      setHighlightId(null);
      highlightTimer.current = null;
    }, 2200);
  }

  function scrollToRow(id: number, anchorTop?: number | null) {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const el = document.getElementById(`zm-tx-row-${id}`);
        if (!el) return;
        if (anchorTop != null) {
          const delta = el.getBoundingClientRect().top - anchorTop;
          if (Math.abs(delta) > 1) {
            window.scrollBy({ top: delta, behavior: "smooth" });
          }
          return;
        }
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  }

  useEffect(() => {
    if (pendingNavId == null || isLoading) return;
    const found = items.find((tx) => tx.id === pendingNavId);
    if (!found) return;
    const anchor = pendingNavAnchorY.current;
    pendingNavAnchorY.current = null;
    flashHighlight(found.id);
    scrollToRow(found.id, anchor);
    setPendingNavId(null);
  }, [pendingNavId, items, isLoading]);

  useEffect(() => {
    return () => {
      if (highlightTimer.current != null) {
        window.clearTimeout(highlightTimer.current);
      }
    };
  }, []);

  async function openRelatedPartner(partnerId: number, fromId: number) {
    const fromEl = document.getElementById(`zm-tx-row-${fromId}`);
    const anchorTop = fromEl?.getBoundingClientRect().top ?? null;

    const onPage = items.find((tx) => tx.id === partnerId);
    if (onPage) {
      flashHighlight(partnerId);
      scrollToRow(partnerId, anchorTop);
      return;
    }

    setNavBusy(true);
    try {
      const nav = await getTransactionNav({
        id: partnerId,
        pageSize,
        banks: banks.length ? banks : undefined,
        konten: konten.length ? konten : undefined,
        typ,
        categorySource,
        includeBalanceAdjustments,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search || undefined,
        categoryId: categoryId ?? undefined,
        subcategoryId: subcategoryId ?? undefined,
      });
      if (!nav) return;

      if (nav.page != null && nav.page !== page) {
        pendingNavAnchorY.current = anchorTop;
        setPendingNavId(partnerId);
        setPage(nav.page);
        return;
      }

      flashHighlight(partnerId);
      if (nav.page != null) scrollToRow(partnerId, anchorTop);
    } finally {
      setNavBusy(false);
    }
  }

  async function handleExportCsv() {
    setExportBusy(true);
    try {
      const result = await exportTransactionsCsv({
        banks: banks.length ? banks : undefined,
        konten: konten.length ? konten : undefined,
        typ,
        categorySource,
        includeBalanceAdjustments,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search || undefined,
        categoryId: categoryId ?? undefined,
        subcategoryId: subcategoryId ?? undefined,
      });
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
      const filterArgs = {
        banks: banks.length ? banks : undefined,
        konten: konten.length ? konten : undefined,
        typ,
        categorySource,
        includeBalanceAdjustments,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        search: search || undefined,
        categoryId: categoryId ?? undefined,
        subcategoryId: subcategoryId ?? undefined,
      };
      const [data, invested] = await Promise.all([
        exportTransactionsForPdf(filterArgs),
        getInvestedTotal({
          banks: banks.length ? banks : undefined,
          konten: konten.length ? konten : undefined,
        }),
      ]);
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
      const catName = selectedCategory?.name ?? null;
      const subName =
        selectedCategory?.subcategories.find((s) => s.id === subcategoryId)
          ?.name ?? null;
      const filterLines = [
        `Zeitraum: ${dateFrom || "—"} bis ${dateTo || "—"}`,
        `Bank: ${banks.length ? banks.join(", ") : "alle"}`,
        `Konto: ${konten.length ? konten.join(", ") : "alle"}`,
        `Typ: ${typLabel}`,
        `Konfidenz: ${categorySource === "all" ? "alle" : SOURCE_LABEL[categorySource]}`,
        catName ? `Kategorie: ${catName}` : null,
        subName ? `Unterkategorie: ${subName}` : null,
        search ? `Suche: ${search}` : null,
        includeBalanceAdjustments ? "Inkl. Saldo-Kalibrierung" : null,
      ].filter((x): x is string => Boolean(x));

      const result = await buildAndDownloadTransactionsPdf({
        metrics: [
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
          {
            label: "Einnahmen",
            value: eur.format(Number(summary?.income ?? 0)),
          },
          {
            label: "Ausgaben",
            value: eur.format(Number(summary?.expense ?? 0)),
          },
          {
            label: "Netto",
            value: eur.format(Number(summary?.net ?? 0)),
          },
          {
            label: "Buchungen",
            value: (summary?.count ?? 0).toLocaleString("de-DE"),
          },
        ],
        filterLines,
        data,
      });

      if (result.truncated) {
        window.alert(
          `PDF enthält nur die ersten ${PDF_TX_MAX_ROWS.toLocaleString("de-DE")} von ${result.totalCount.toLocaleString("de-DE")} Buchungen. Für den vollständigen Export bitte CSV nutzen.`,
        );
      }
    } catch (err) {
      window.alert(
        err instanceof Error ? err.message : "PDF-Export fehlgeschlagen.",
      );
    } finally {
      setExportBusy(false);
    }
  }

  return (
    <section className="zm-tx-page">
      <PageTitle icon="/design/Tables.svg">Transaktionen</PageTitle>

      <div className="zm-tx-topbar" aria-live="polite">
        <div className="zm-summary-inline">
          <KontostandSummaryStat banks={banks} konten={konten} />
          <InvestiertSummaryStat banks={banks} konten={konten} />
          <div>
            <span className="zm-summary-label zm-summary-label-with-info">
              Einnahmen <SummaryApproxInfo />
            </span>
            <span className="zm-amount-income">
              {eur.format(Number(summary?.income ?? 0))}
            </span>
          </div>
          <div>
            <span className="zm-summary-label zm-summary-label-with-info">
              Ausgaben <SummaryApproxInfo />
            </span>
            <span className="zm-amount-expense">
              {eur.format(Number(summary?.expense ?? 0))}
            </span>
          </div>
          <div>
            <span className="zm-summary-label zm-summary-label-with-info">
              Netto <SummaryApproxInfo />
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
            className="zm-btn zm-btn-primary zm-btn-with-icon"
            disabled={relatedOpen || investmentOpen}
            onClick={() => setInvestmentOpen(true)}
            title="Erkennt mögliche Investments (z. B. ETF-Käufe) anhand der Stichwörter aus den Einstellungen — du bestätigst danach."
            aria-label="Investitionen erkennen"
          >
            <img
              src="/design/Magic.svg"
              alt=""
              className="zm-btn-magic"
              aria-hidden
            />
            Investitionen
          </button>
          <button
            type="button"
            className="zm-btn zm-btn-primary zm-btn-with-icon"
            disabled={relatedOpen || investmentOpen}
            onClick={() => setRelatedOpen(true)}
            title="Sucht verknüpfbare Buchungen (PayPal↔Bank, Umbuchungen, ähnliche) — du bestätigst oder verwirfst die Vorschläge."
            aria-label="Zusammengehörige erkennen"
          >
            <img
              src="/design/Magic.svg"
              alt=""
              className="zm-btn-magic"
              aria-hidden
            />
            Zusammengehörige
          </button>
          <button
            type="button"
            className="zm-btn zm-btn-ghost zm-btn-with-icon"
            disabled={exportBusy || relatedOpen}
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
            disabled={exportBusy || relatedOpen}
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

      <div className={`zm-toolbar${filtersOpen ? "" : " is-collapsed"}`}>
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
                  onClick={() => {
                    setBanks((prev) => toggleValue(prev, bank));
                    resetPage();
                  }}
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
                  onClick={() => {
                    setKonten((prev) => toggleValue(prev, konto));
                    resetPage();
                  }}
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

        <div className="zm-filter-group">
          <span className="zm-field-label">Zeitraum</span>
          <div className="zm-chip-row">
            {DATE_PRESET_CHIPS.filter((c) => c.transactions).map(
              ({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  className={`zm-chip${preset === key ? " is-active" : ""}`}
                  onClick={() => applyPreset(key)}
                >
                  {label}
                </button>
              ),
            )}
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
              resetPage();
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
              resetPage();
            }}
          />
        </label>

        <label className="zm-field zm-field-inline zm-field-search">
          <span className="zm-field-label">Suche</span>
          <input
            className="zm-input"
            type="search"
            value={searchInput}
            placeholder="Zweck, Sender, Empfänger…"
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </label>

        <label className="zm-field zm-field-inline">
          <span className="zm-field-label">Typ</span>
          <select
            className="zm-select"
            value={typ}
            onChange={(e) => {
              setTyp(e.target.value as TransactionTyp);
              resetPage();
            }}
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
              resetPage();
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
                resetPage();
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

        <label className="zm-field zm-field-inline">
          <span className="zm-field-label">Konfidenz</span>
          <select
            className="zm-select"
            value={categorySource}
            onChange={(e) => {
              setCategorySource(e.target.value as CategorySourceFilter);
              resetPage();
            }}
          >
            <option value="all">Alle</option>
            <option value="manual">Manuell</option>
            <option value="learned">Gelernt</option>
            <option value="keyword">Stichwort</option>
            <option value="none">Keine</option>
          </select>
        </label>

        <label className="zm-field zm-field-inline zm-field-check">
          <input
            type="checkbox"
            checked={includeBalanceAdjustments}
            onChange={(e) => {
              setIncludeBalanceAdjustments(e.target.checked);
              resetPage();
            }}
          />
          <span className="zm-field-label">Saldo-Kalibrierung zeigen</span>
        </label>

        <label className="zm-field zm-field-inline">
          <span className="zm-field-label">Seite</span>
          <select
            className="zm-select"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              resetPage();
            }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} / Seite
              </option>
            ))}
          </select>
        </label>

        <div className="zm-columns-menu" ref={columnsPanelRef}>
          <button
            type="button"
            className="zm-btn zm-btn-ghost"
            aria-expanded={columnsOpen}
            onClick={() => setColumnsOpen((o) => !o)}
          >
            Spalten
          </button>
          {columnsOpen && (
            <div className="zm-columns-panel" role="menu">
              {TX_COLUMN_DEFS.map((col) => (
                <label key={col.key} className="zm-field-check">
                  <input
                    type="checkbox"
                    checked={columns[col.key]}
                    onChange={(e) => setColumn(col.key, e.target.checked)}
                  />
                  <span>{col.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {isLoading && <p className="zm-page-lead">Laden…</p>}
      {error && (
        <p className="zm-status-error" role="alert">
          {String(error)}
        </p>
      )}

      {!isLoading && items.length === 0 && (
        <p className="zm-page-lead">
          Keine Transaktionen für die aktuellen Filter. Importiere unter Upload
          oder Filter zurücksetzen.
        </p>
      )}

      {items.length > 0 && (
        <>
          <div className="zm-table-wrap">
            <table className="zm-table">
              <thead>
                <tr>
                  {show("datum") && <th>Datum</th>}
                  {show("bank") && <th>Bank</th>}
                  {show("konto") && <th>Konto</th>}
                  {show("sender") && <th>Sender</th>}
                  {show("empfaenger") && <th>Empfänger</th>}
                  {show("verwendungszweck") && <th>Verwendungszweck</th>}
                  {show("iban") && <th>IBAN</th>}
                  {show("kundenreferenz") && <th>Kundenref.</th>}
                  {show("kategorie") && <th>Kategorie</th>}
                  {show("konfidenz") && <th>Konfidenz</th>}
                  {show("related") && (
                    <th title="Verknüpfung">
                      <Link2 size={14} aria-hidden />
                      <span className="sr-only">Verknüpfung</span>
                    </th>
                  )}
                  {show("betrag") && <th className="zm-num">Betrag</th>}
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((tx) => {
                  const amount = Number(tx.betrag);
                  const amountClass = tx.isInvestment
                    ? "zm-amount-investment"
                    : amount > 0
                      ? "zm-amount-income"
                      : amount < 0
                        ? "zm-amount-expense"
                        : "";
                  const catLabel =
                    tx.categoryName && tx.subcategoryName
                      ? `${tx.categoryName} › ${tx.subcategoryName}`
                      : (tx.categoryName ?? "—");
                  const highlighted = highlightId === tx.id;
                  const badgeColor = bankBadgeColor(
                    tx.bank,
                    accountColorByKey.get(`${tx.bank}\0${tx.konto}`),
                  );
                  return (
                    <tr
                      key={tx.id}
                      id={`zm-tx-row-${tx.id}`}
                      className={highlighted ? "is-highlight" : undefined}
                    >
                      {show("datum") && (
                        <td>{dateDe.format(new Date(tx.datum))}</td>
                      )}
                      {show("bank") && (
                        <td>
                          <span
                            className={bankBadgeClass()}
                            style={{
                              color: badgeColor,
                              borderColor: badgeColor,
                            }}
                          >
                            {bankLabel(tx.bank)}
                          </span>
                        </td>
                      )}
                      {show("konto") && (
                        <td>
                          <span className={kontoPillClass(tx.konto)}>
                            {tx.konto}
                          </span>
                        </td>
                      )}
                      {show("sender") && (
                        <td className="zm-party" title={tx.sender}>
                          {tx.sender}
                        </td>
                      )}
                      {show("empfaenger") && (
                        <td className="zm-party" title={tx.empfaenger}>
                          {tx.empfaenger}
                        </td>
                      )}
                      {show("verwendungszweck") && (
                        <td className="zm-zweck" title={tx.verwendungszweck}>
                          {tx.verwendungszweck}
                        </td>
                      )}
                      {show("iban") && <td title={tx.iban}>{tx.iban || "—"}</td>}
                      {show("kundenreferenz") && (
                        <td title={tx.kundenreferenz}>
                          {tx.kundenreferenz || "—"}
                        </td>
                      )}
                      {show("kategorie") && (
                        <td title={catLabel}>
                          <span className="zm-cat-cell">
                            <span
                              className="zm-cat-dot"
                              style={{
                                background:
                                  tx.categoryColor || "var(--zm-text-muted)",
                              }}
                              aria-hidden
                            />
                            <span>{catLabel}</span>
                          </span>
                        </td>
                      )}
                      {show("konfidenz") && (
                        <td>
                          <span
                            className={`zm-conf zm-conf-${tx.categorySource}`}
                          >
                            {SOURCE_LABEL[tx.categorySource]}
                          </span>
                        </td>
                      )}
                      {show("related") && (
                        <td className="zm-related-cell">
                          {(tx.relatedIds?.length ?? 0) > 0 ||
                          tx.relatedTransactionId != null ? (
                            <span className="zm-related-links">
                              {(tx.relatedIds?.length
                                ? tx.relatedIds
                                : tx.relatedTransactionId != null
                                  ? [tx.relatedTransactionId]
                                  : []
                              ).map((partnerId) => (
                                <button
                                  key={partnerId}
                                  type="button"
                                  className="zm-related-link"
                                  disabled={navBusy}
                                  title={`Zu verknüpfter Transaktion #${partnerId}`}
                                  onClick={() =>
                                    void openRelatedPartner(partnerId, tx.id)
                                  }
                                >
                                  <Link2 size={16} aria-hidden />
                                  <span className="sr-only">
                                    Zu verknüpfter Transaktion {partnerId}
                                  </span>
                                </button>
                              ))}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                      {show("betrag") && (
                        <td className={`zm-num ${amountClass}`}>
                          {eur.format(amount)}
                        </td>
                      )}
                      <td>
                        <EditIconButton
                          label="Bearbeiten"
                          onClick={() => setSelected(tx)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="zm-pagination">
            <button
              type="button"
              className="zm-btn zm-btn-ghost"
              disabled={!data || data.page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Zurück
            </button>
            <span className="zm-pagination-info">
              Seite {data?.page ?? 1} von {data?.pageCount ?? 1} (
              {(data?.totalCount ?? 0).toLocaleString("de-DE")} gesamt)
            </span>
            <button
              type="button"
              className="zm-btn zm-btn-ghost"
              disabled={!data || data.page >= data.pageCount}
              onClick={() =>
                setPage((p) =>
                  data ? Math.min(data.pageCount, p + 1) : p + 1,
                )
              }
            >
              Weiter
            </button>
          </div>
        </>
      )}

      {selected && (
        <TransactionDetailsOverlay
          tx={selected}
          onClose={() => setSelected(null)}
          onSaved={() => {
            void refetch();
          }}
        />
      )}

      {relatedOpen && (
        <RelatedDetectOverlay
          onClose={() => {
            setRelatedOpen(false);
            void refetch();
          }}
          onChanged={() => {
            void refetch();
          }}
        />
      )}

      {investmentOpen && (
        <InvestmentDetectOverlay
          onClose={() => {
            setInvestmentOpen(false);
            void refetch();
          }}
          onChanged={() => {
            void refetch();
          }}
        />
      )}
    </section>
  );
}
