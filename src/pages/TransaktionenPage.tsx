import { useEffect, useMemo, useRef, useState } from "react";
import { Link2 } from "lucide-react";
import {
  exportTransactionsCsv,
  getTransactionFilterOptions,
  getTransactionNav,
  getTransactions,
  getTransactionsSummary,
  useQuery,
} from "wasp/client/operations";
import { RelatedDetectOverlay } from "../components/RelatedDetectOverlay";
import { TransactionDetailsOverlay } from "../components/TransactionDetailsOverlay";
import { downloadCsv } from "../features/export/csv";
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

function yearStartIso(): string {
  return `${new Date().getFullYear()}-01-01`;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function TransaktionenPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [banks, setBanks] = useState<string[]>([]);
  const [konten, setKonten] = useState<string[]>([]);
  const [typ, setTyp] = useState<TransactionTyp>("all");
  const [categorySource, setCategorySource] =
    useState<CategorySourceFilter>("all");
  const [includeBalanceAdjustments, setIncludeBalanceAdjustments] =
    useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [columns, setColumns] = useState<ColumnVisibility>(() =>
    typeof window !== "undefined"
      ? loadColumnVisibility()
      : (Object.fromEntries(
          TX_COLUMN_DEFS.map((c) => [c.key, c.defaultVisible]),
        ) as ColumnVisibility),
  );
  const [selected, setSelected] = useState<TransactionListItem | null>(null);
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [pendingNavId, setPendingNavId] = useState<number | null>(null);
  const [navBusy, setNavBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);
  const highlightTimer = useRef<number | null>(null);
  const columnsPanelRef = useRef<HTMLDivElement | null>(null);

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
    ],
  );

  const { data: options } = useQuery(getTransactionFilterOptions);
  const { data, isLoading, error, refetch } = useQuery(
    getTransactions,
    filterArgs,
  );
  const { data: summary } = useQuery(getTransactionsSummary, summaryArgs);

  const items = data?.items ?? [];
  const show = (key: TxColumnKey) => columns[key];

  function resetPage() {
    setPage(1);
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

  function scrollToRow(id: number) {
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`zm-tx-row-${id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  useEffect(() => {
    if (pendingNavId == null || isLoading) return;
    const found = items.find((tx) => tx.id === pendingNavId);
    if (!found) return;
    setSelected(found);
    flashHighlight(found.id);
    scrollToRow(found.id);
    setPendingNavId(null);
  }, [pendingNavId, items, isLoading]);

  useEffect(() => {
    return () => {
      if (highlightTimer.current != null) {
        window.clearTimeout(highlightTimer.current);
      }
    };
  }, []);

  async function openRelatedPartner(partnerId: number) {
    const onPage = items.find((tx) => tx.id === partnerId);
    if (onPage) {
      setSelected(onPage);
      flashHighlight(partnerId);
      scrollToRow(partnerId);
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
      });
      if (!nav) return;

      if (nav.page != null && nav.page !== page) {
        setPendingNavId(partnerId);
        setPage(nav.page);
        return;
      }

      setSelected(nav.item);
      flashHighlight(partnerId);
      if (nav.page != null) scrollToRow(partnerId);
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

  return (
    <section className="zm-tx-page">
      <h1 className="zm-page-title">Transaktionen</h1>

      <div className="zm-summary-strip" aria-live="polite">
        <div>
          <span className="zm-summary-label">Einnahmen</span>
          <span className="zm-amount-income">
            {eur.format(Number(summary?.income ?? 0))}
          </span>
        </div>
        <div>
          <span className="zm-summary-label">Ausgaben</span>
          <span className="zm-amount-expense">
            {eur.format(Number(summary?.expense ?? 0))}
          </span>
        </div>
        <div>
          <span className="zm-summary-label">Buchungen</span>
          <span className="zm-summary-value">
            {(summary?.count ?? 0).toLocaleString("de-DE")}
          </span>
        </div>
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

        <label className="zm-field zm-field-inline">
          <span className="zm-field-label">Von</span>
          <input
            className="zm-input"
            type="date"
            value={dateFrom}
            onChange={(e) => {
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
              setDateTo(e.target.value);
              resetPage();
            }}
          />
        </label>
        <div className="zm-chip-row zm-date-presets">
          <button
            type="button"
            className="zm-chip"
            onClick={() => {
              setDateFrom(yearStartIso());
              setDateTo(todayIso());
              resetPage();
            }}
          >
            Dieses Jahr
          </button>
          <button
            type="button"
            className="zm-chip"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              resetPage();
            }}
          >
            Alle Zeiten
          </button>
        </div>

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

        <button
          type="button"
          className="zm-btn zm-btn-ghost"
          disabled={exportBusy || relatedOpen}
          onClick={() => void handleExportCsv()}
        >
          {exportBusy ? "Export…" : "CSV exportieren"}
        </button>

        <button
          type="button"
          className="zm-btn zm-btn-primary zm-toolbar-action"
          disabled={relatedOpen}
          onClick={() => setRelatedOpen(true)}
        >
          Zusammengehörige erkennen
        </button>
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
                  const amountClass =
                    amount > 0
                      ? "zm-amount-income"
                      : amount < 0
                        ? "zm-amount-expense"
                        : "";
                  const catLabel =
                    tx.categoryName && tx.subcategoryName
                      ? `${tx.categoryName} › ${tx.subcategoryName}`
                      : (tx.categoryName ?? "—");
                  const highlighted = highlightId === tx.id;
                  return (
                    <tr
                      key={tx.id}
                      id={`zm-tx-row-${tx.id}`}
                      className={highlighted ? "is-highlight" : undefined}
                    >
                      {show("datum") && (
                        <td>{dateDe.format(new Date(tx.datum))}</td>
                      )}
                      {show("bank") && <td>{tx.bank.toUpperCase()}</td>}
                      {show("konto") && <td>{tx.konto}</td>}
                      {show("sender") && <td title={tx.sender}>{tx.sender}</td>}
                      {show("empfaenger") && (
                        <td title={tx.empfaenger}>{tx.empfaenger}</td>
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
                        <td title={catLabel}>{catLabel}</td>
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
                          {tx.relatedTransactionId != null ? (
                            <button
                              type="button"
                              className="zm-related-link"
                              disabled={navBusy}
                              title={`Zu verknüpfter Transaktion #${tx.relatedTransactionId}`}
                              onClick={() =>
                                void openRelatedPartner(
                                  tx.relatedTransactionId!,
                                )
                              }
                            >
                              <Link2 size={16} aria-hidden />
                              <span className="sr-only">
                                Zu verknüpfter Transaktion{" "}
                                {tx.relatedTransactionId}
                              </span>
                            </button>
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
                        <button
                          type="button"
                          className="zm-btn zm-btn-ghost"
                          onClick={() => setSelected(tx)}
                        >
                          Details
                        </button>
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
    </section>
  );
}
