import { useEffect, useMemo, useRef, useState } from "react";
import { Link2 } from "lucide-react";
import {
  getTransactionFilterOptions,
  getTransactionNav,
  getTransactions,
  getTransactionsSummary,
  useQuery,
} from "wasp/client/operations";
import { RelatedDetectOverlay } from "../components/RelatedDetectOverlay";
import { TransactionDetailsOverlay } from "../components/TransactionDetailsOverlay";
import type { TransactionListItem } from "../features/transactions/types";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  type TransactionTyp,
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [banks, setBanks] = useState<string[]>([]);
  const [konten, setKonten] = useState<string[]>([]);
  const [typ, setTyp] = useState<TransactionTyp>("all");
  const [selected, setSelected] = useState<TransactionListItem | null>(null);
  const [relatedOpen, setRelatedOpen] = useState(false);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [pendingNavId, setPendingNavId] = useState<number | null>(null);
  const [navBusy, setNavBusy] = useState(false);
  const highlightTimer = useRef<number | null>(null);

  const filterArgs = useMemo(
    () => ({
      page,
      pageSize,
      banks: banks.length ? banks : undefined,
      konten: konten.length ? konten : undefined,
      typ,
    }),
    [page, pageSize, banks, konten, typ],
  );

  const summaryArgs = useMemo(
    () => ({
      banks: banks.length ? banks : undefined,
      konten: konten.length ? konten : undefined,
      typ,
    }),
    [banks, konten, typ],
  );

  const { data: options } = useQuery(getTransactionFilterOptions);
  const { data, isLoading, error, refetch } = useQuery(
    getTransactions,
    filterArgs,
  );
  const { data: summary } = useQuery(getTransactionsSummary, summaryArgs);

  const items = data?.items ?? [];

  function resetPage() {
    setPage(1);
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
      });
      if (!nav) return;

      if (nav.page != null && nav.page !== page) {
        setPendingNavId(partnerId);
        setPage(nav.page);
        return;
      }

      // Filtered out of list, or already on this page but not loaded yet.
      setSelected(nav.item);
      flashHighlight(partnerId);
      if (nav.page != null) scrollToRow(partnerId);
    } finally {
      setNavBusy(false);
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
          Keine Transaktionen für die aktuellen Filter. Importiere eine DKB-CSV
          unter Upload oder Filter zurücksetzen.
        </p>
      )}

      {items.length > 0 && (
        <>
          <div className="zm-table-wrap">
            <table className="zm-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Bank</th>
                  <th>Konto</th>
                  <th>Sender</th>
                  <th>Empfänger</th>
                  <th>Verwendungszweck</th>
                  <th>Kategorie</th>
                  <th>Konfidenz</th>
                  <th title="Verknüpfung">
                    <Link2 size={14} aria-hidden />
                    <span className="sr-only">Verknüpfung</span>
                  </th>
                  <th className="zm-num">Betrag</th>
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
                      <td>{dateDe.format(new Date(tx.datum))}</td>
                      <td>{tx.bank.toUpperCase()}</td>
                      <td>{tx.konto}</td>
                      <td title={tx.sender}>{tx.sender}</td>
                      <td title={tx.empfaenger}>{tx.empfaenger}</td>
                      <td className="zm-zweck" title={tx.verwendungszweck}>
                        {tx.verwendungszweck}
                      </td>
                      <td title={catLabel}>{catLabel}</td>
                      <td>
                        <span
                          className={`zm-conf zm-conf-${tx.categorySource}`}
                        >
                          {SOURCE_LABEL[tx.categorySource]}
                        </span>
                      </td>
                      <td className="zm-related-cell">
                        {tx.relatedTransactionId != null ? (
                          <button
                            type="button"
                            className="zm-related-link"
                            disabled={navBusy}
                            title={`Zu verknüpfter Transaktion #${tx.relatedTransactionId}`}
                            onClick={() =>
                              void openRelatedPartner(tx.relatedTransactionId!)
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
                      <td className={`zm-num ${amountClass}`}>
                        {eur.format(amount)}
                      </td>
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
          onClose={() => setRelatedOpen(false)}
          onChanged={() => {
            void refetch();
          }}
        />
      )}
    </section>
  );
}
