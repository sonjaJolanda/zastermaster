import { useEffect, useMemo, useState } from "react";
import {
  categorizeTransaction,
  clearInvestment,
  confirmInvestment,
  confirmRelatedPair,
  getCategories,
  searchRelatedLinkCandidates,
  unlinkRelatedPair,
  useQuery,
} from "wasp/client/operations";
import { CloseIconButton } from "./PageChrome";
import { OverlayPortal } from "./OverlayPortal";
import { suggestRelatedTypeForGroup } from "../features/related/suggestType";
import type {
  RelatedTxPublic,
  RelatedType,
} from "../features/related/types";
import type { TransactionListItem } from "../features/transactions/types";
import { suggestKeywordsFromTransaction } from "../features/categorization/suggestKeywords";

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

const RELATED_TYPE_LABEL: Record<RelatedType, string> = {
  transfer: "Umbuchung",
  paypal_bank: "PayPal↔Bank",
  paypal_purchase: "PayPal-Kauf",
  near_duplicate: "Ähnlich",
};

const MAX_PARTNERS = 2;

type Props = {
  tx: TransactionListItem;
  onClose: () => void;
  onSaved: () => void;
};

export function TransactionDetailsOverlay({ tx, onClose, onSaved }: Props) {
  const { data: categories } = useQuery(getCategories);
  const [categoryId, setCategoryId] = useState<number | "">(
    tx.categoryId ?? "",
  );
  const [subcategoryId, setSubcategoryId] = useState<number | "">(
    tx.subcategoryId ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkSearchInput, setLinkSearchInput] = useState("");
  const [linkSearch, setLinkSearch] = useState("");
  const [candidates, setCandidates] = useState<RelatedTxPublic[]>([]);
  const [partners, setPartners] = useState<RelatedTxPublic[]>([]);
  const [linkType, setLinkType] = useState<RelatedType>("near_duplicate");
  const [candidatesBusy, setCandidatesBusy] = useState(false);

  const relatedIds = tx.relatedIds ?? [];
  const isLinked =
    relatedIds.length > 0 ||
    tx.relatedTransactionId != null ||
    tx.relatedGroupId != null;

  const excludeIds = useMemo(
    () => [tx.id, ...partners.map((p) => p.id)],
    [tx.id, partners],
  );

  useEffect(() => {
    setCategoryId(tx.categoryId ?? "");
    setSubcategoryId(tx.subcategoryId ?? "");
    setSelectedKeywords([]);
    setError(null);
    setLinkOpen(false);
    setLinkSearchInput("");
    setLinkSearch("");
    setCandidates([]);
    setPartners([]);
  }, [tx.id, tx.categoryId, tx.subcategoryId]);

  useEffect(() => {
    const t = window.setTimeout(
      () => setLinkSearch(linkSearchInput.trim()),
      250,
    );
    return () => window.clearTimeout(t);
  }, [linkSearchInput]);

  useEffect(() => {
    if (!linkOpen) return;
    let cancelled = false;
    setCandidatesBusy(true);
    void searchRelatedLinkCandidates({
      excludeIds,
      aroundDate: tx.datum,
      search: linkSearch || undefined,
    })
      .then((rows) => {
        if (!cancelled) setCandidates(rows);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Suche fehlgeschlagen.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setCandidatesBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [linkOpen, linkSearch, excludeIds, tx.datum]);

  const subs = useMemo(() => {
    if (!categories || categoryId === "") return [];
    return (
      categories.find((c) => c.id === categoryId)?.subcategories ?? []
    );
  }, [categories, categoryId]);

  const selectedCategory = useMemo(() => {
    if (!categories || categoryId === "") return undefined;
    return categories.find((c) => c.id === categoryId);
  }, [categories, categoryId]);

  const selectedSubcategory = useMemo(() => {
    if (!selectedCategory || subcategoryId === "") return undefined;
    return selectedCategory.subcategories.find((s) => s.id === subcategoryId);
  }, [selectedCategory, subcategoryId]);

  const existingKeywords = useMemo(() => {
    return [
      ...(selectedCategory?.keywords ?? []).map((k) => k.keyword),
      ...(selectedSubcategory?.keywords ?? []).map((k) => k.keyword),
    ];
  }, [selectedCategory, selectedSubcategory]);

  const keywordSuggestions = useMemo(
    () =>
      suggestKeywordsFromTransaction(
        {
          sender: tx.sender,
          empfaenger: tx.empfaenger,
          verwendungszweck: tx.verwendungszweck,
        },
        existingKeywords,
      ),
    [tx.sender, tx.empfaenger, tx.verwendungszweck, existingKeywords],
  );

  useEffect(() => {
    setSelectedKeywords((prev) =>
      prev.filter((k) => keywordSuggestions.includes(k)),
    );
  }, [keywordSuggestions]);

  useEffect(() => {
    if (categoryId === "") {
      setSubcategoryId("");
      return;
    }
    if (
      subcategoryId !== "" &&
      !subs.some((s) => s.id === subcategoryId)
    ) {
      setSubcategoryId(subs[0]?.id ?? "");
    }
  }, [categoryId, subcategoryId, subs]);

  function refreshLinkType(nextPartners: RelatedTxPublic[]) {
    const legs = [
      {
        bank: tx.bank,
        konto: tx.konto,
        betrag: Number(tx.betrag),
      },
      ...nextPartners.map((p) => ({
        bank: p.bank,
        konto: p.konto,
        betrag: Number(p.betrag),
      })),
    ];
    setLinkType(suggestRelatedTypeForGroup(legs));
  }

  function togglePartner(c: RelatedTxPublic) {
    setPartners((prev) => {
      const exists = prev.some((p) => p.id === c.id);
      let next: RelatedTxPublic[];
      if (exists) {
        next = prev.filter((p) => p.id !== c.id);
      } else if (prev.length >= MAX_PARTNERS) {
        next = [...prev.slice(0, MAX_PARTNERS - 1), c];
      } else {
        next = [...prev, c];
      }
      refreshLinkType(next);
      return next;
    });
  }

  async function handleSave() {
    if (categoryId === "" || subcategoryId === "") {
      setError("Bitte Kategorie und Unterkategorie wählen.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await categorizeTransaction({
        transactionId: tx.id,
        categoryId: Number(categoryId),
        subcategoryId: Number(subcategoryId),
        rememberKeywords:
          selectedKeywords.length > 0 ? selectedKeywords : undefined,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Speichern fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleClearInvestment() {
    setBusy(true);
    setError(null);
    try {
      await clearInvestment({ transactionId: tx.id });
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Investition konnte nicht entfernt werden.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkInvestment() {
    setBusy(true);
    setError(null);
    try {
      await confirmInvestment({ transactionId: tx.id });
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Als Investition markieren fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleUnlinkRelated() {
    setBusy(true);
    setError(null);
    try {
      await unlinkRelatedPair({ transactionId: tx.id });
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Verknüpfung konnte nicht gelöst werden.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmLink() {
    if (partners.length < 1 || partners.length > MAX_PARTNERS) {
      setError("Bitte 1 oder 2 Partner-Buchungen wählen.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await confirmRelatedPair({
        ids: [tx.id, ...partners.map((p) => p.id)],
        type: linkType,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Verknüpfung fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }

  const amount = Number(tx.betrag);
  const displayRelatedIds =
    relatedIds.length > 0
      ? relatedIds
      : tx.relatedTransactionId != null
        ? [tx.relatedTransactionId]
        : [];

  return (
    <OverlayPortal>
      <div
        className="zm-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="zm-details-title"
        onClick={onClose}
      >
        <div className="zm-overlay-anchor">
          <div
            className="zm-overlay-panel"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="zm-overlay-header">
              <h2 id="zm-details-title">Details</h2>
              <CloseIconButton onClick={onClose} />
            </header>

            <div className="zm-details-grid">
              <dl className="zm-details-fields">
                <div>
                  <dt>Id</dt>
                  <dd>{tx.id}</dd>
                </div>
                <div>
                  <dt>Datum</dt>
                  <dd>{dateDe.format(new Date(tx.datum))}</dd>
                </div>
                <div>
                  <dt>Bank / Konto</dt>
                  <dd>
                    {tx.bank.toUpperCase()} · {tx.konto}
                  </dd>
                </div>
                <div>
                  <dt>Betrag</dt>
                  <dd
                    className={
                      amount > 0
                        ? "zm-amount-income"
                        : amount < 0
                          ? "zm-amount-expense"
                          : ""
                    }
                  >
                    {eur.format(amount)}
                  </dd>
                </div>
                <div>
                  <dt>Sender</dt>
                  <dd>{tx.sender || "—"}</dd>
                </div>
                <div>
                  <dt>Empfänger</dt>
                  <dd>{tx.empfaenger || "—"}</dd>
                </div>
                <div className="zm-details-full">
                  <dt>Verwendungszweck</dt>
                  <dd>{tx.verwendungszweck || "—"}</dd>
                </div>
                <div>
                  <dt>IBAN</dt>
                  <dd>{tx.iban || "—"}</dd>
                </div>
                <div>
                  <dt>Kundenreferenz</dt>
                  <dd>{tx.kundenreferenz || "—"}</dd>
                </div>
                <div className="zm-details-full">
                  <dt>Verknüpfung</dt>
                  <dd>
                    {isLinked ? (
                      <>
                        {displayRelatedIds.map((id) => `#${id}`).join(", ")}
                        {tx.relatedType
                          ? ` (${RELATED_TYPE_LABEL[tx.relatedType]})`
                          : ""}
                        <button
                          type="button"
                          className="zm-btn zm-btn-ghost"
                          style={{ marginLeft: "0.75rem" }}
                          disabled={busy}
                          onClick={() => void handleUnlinkRelated()}
                        >
                          {busy ? "Lösen…" : "Verknüpfung lösen"}
                        </button>
                      </>
                    ) : !linkOpen ? (
                      <button
                        type="button"
                        className="zm-btn zm-btn-ghost"
                        disabled={busy}
                        onClick={() => setLinkOpen(true)}
                      >
                        Manuell verknüpfen…
                      </button>
                    ) : (
                      <div className="zm-link-picker">
                        <p className="zm-page-lead">
                          1 Partner (Paar) oder 2 Partner (z.B. PayPal-Kauf)
                          auswählen. Nur Buchungen ±10 Tage um dieses Datum.
                        </p>
                        <label className="zm-field">
                          <span className="zm-field-label">
                            Partner suchen
                          </span>
                          <input
                            className="zm-input"
                            type="search"
                            value={linkSearchInput}
                            placeholder="Id, Zweck, Bank, Sender…"
                            onChange={(e) =>
                              setLinkSearchInput(e.target.value)
                            }
                            autoFocus
                          />
                        </label>
                        <div className="zm-link-candidates" role="listbox">
                          {candidatesBusy && (
                            <p className="zm-page-lead">Suche…</p>
                          )}
                          {!candidatesBusy && candidates.length === 0 && (
                            <p className="zm-page-lead">Keine Treffer.</p>
                          )}
                          {candidates.map((c) => {
                            const selected = partners.some(
                              (p) => p.id === c.id,
                            );
                            return (
                              <button
                                key={c.id}
                                type="button"
                                role="option"
                                aria-selected={selected}
                                className={`zm-link-candidate${selected ? " is-selected" : ""}`}
                                onClick={() => togglePartner(c)}
                              >
                                <span className="zm-link-candidate-meta">
                                  #{c.id} ·{" "}
                                  {dateDe.format(new Date(c.datum))} ·{" "}
                                  {c.bank.toUpperCase()} · {c.konto}
                                </span>
                                <span className="zm-link-candidate-zweck">
                                  {c.verwendungszweck || "—"}
                                </span>
                                <span
                                  className={`zm-link-candidate-amount${
                                    Number(c.betrag) > 0
                                      ? " zm-amount-income"
                                      : Number(c.betrag) < 0
                                        ? " zm-amount-expense"
                                        : ""
                                  }`}
                                >
                                  {eur.format(Number(c.betrag))}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                        {partners.length > 0 && (
                          <>
                            <label className="zm-field">
                              <span className="zm-field-label">Typ</span>
                              <select
                                className="zm-select"
                                value={linkType}
                                onChange={(e) =>
                                  setLinkType(e.target.value as RelatedType)
                                }
                              >
                                {(
                                  Object.keys(
                                    RELATED_TYPE_LABEL,
                                  ) as RelatedType[]
                                ).map((t) => (
                                  <option key={t} value={t}>
                                    {RELATED_TYPE_LABEL[t]}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <p className="zm-page-lead">
                              Gewählt:{" "}
                              {partners.map((p) => `#${p.id}`).join(", ")} (
                              {RELATED_TYPE_LABEL[linkType]})
                            </p>
                          </>
                        )}
                        <div className="zm-btn-row">
                          <button
                            type="button"
                            className="zm-btn zm-btn-ghost"
                            disabled={busy}
                            onClick={() => {
                              setLinkOpen(false);
                              setPartners([]);
                              setLinkSearchInput("");
                            }}
                          >
                            Abbrechen
                          </button>
                          <button
                            type="button"
                            className="zm-btn zm-btn-primary"
                            disabled={busy || partners.length === 0}
                            onClick={() => void handleConfirmLink()}
                          >
                            {busy ? "Verknüpfen…" : "Verknüpfen"}
                          </button>
                        </div>
                      </div>
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Konfidenz</dt>
                  <dd>
                    <span
                      className={`zm-conf zm-conf-${tx.categorySource}`}
                    >
                      {SOURCE_LABEL[tx.categorySource]}
                    </span>
                  </dd>
                </div>
                <div className="zm-details-full">
                  <dt>Investition</dt>
                  <dd>
                    {tx.isInvestment ? (
                      <>
                        <span className="zm-conf zm-conf-manual">
                          Bestätigt
                        </span>
                        <button
                          type="button"
                          className="zm-btn zm-btn-ghost"
                          style={{ marginLeft: "0.75rem" }}
                          disabled={busy}
                          onClick={() => void handleClearInvestment()}
                        >
                          {busy ? "Entfernen…" : "Investition entfernen"}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="zm-btn zm-btn-ghost"
                        disabled={busy}
                        onClick={() => void handleMarkInvestment()}
                      >
                        {busy ? "Markieren…" : "Als Investition markieren"}
                      </button>
                    )}
                  </dd>
                </div>
              </dl>

              <div className="zm-details-cat">
                <h3>Kategorisieren</h3>
                {displayRelatedIds.length > 0 && (
                  <p className="zm-page-lead">
                    Speichern gilt auch für verknüpfte Transaktion
                    {displayRelatedIds.length > 1 ? "en" : ""}{" "}
                    {displayRelatedIds.map((id) => `#${id}`).join(", ")}.
                  </p>
                )}
                <label className="zm-field">
                  <span className="zm-field-label">Kategorie</span>
                  <select
                    className="zm-select"
                    value={categoryId === "" ? "" : String(categoryId)}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCategoryId(v ? Number(v) : "");
                    }}
                  >
                    <option value="">— wählen —</option>
                    {(categories ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="zm-field">
                  <span className="zm-field-label">Unterkategorie</span>
                  <select
                    className="zm-select"
                    value={
                      subcategoryId === "" ? "" : String(subcategoryId)
                    }
                    disabled={categoryId === ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSubcategoryId(v ? Number(v) : "");
                    }}
                  >
                    <option value="">— wählen —</option>
                    {subs.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                {keywordSuggestions.length > 0 && (
                  <div className="zm-keyword-suggest">
                    <p className="zm-keyword-suggest-target">
                      {categoryId !== "" && subcategoryId !== "" ? (
                        <>
                          Stichwörter für{" "}
                          <strong>
                            {selectedCategory?.name} / {selectedSubcategory?.name}
                          </strong>
                        </>
                      ) : (
                        <>Zuerst Kategorie und Unterkategorie wählen.</>
                      )}
                    </p>
                    <div
                      className="zm-chip-row"
                      role="group"
                      aria-label="Stichwort-Vorschläge"
                    >
                      {keywordSuggestions.map((kw) => {
                        const active = selectedKeywords.includes(kw);
                        return (
                          <button
                            key={kw}
                            type="button"
                            className={`zm-chip${active ? " is-active" : ""}`}
                            disabled={busy || subcategoryId === ""}
                            aria-pressed={active}
                            onClick={() => {
                              setSelectedKeywords((prev) =>
                                prev.includes(kw)
                                  ? prev.filter((k) => k !== kw)
                                  : [...prev, kw],
                              );
                            }}
                          >
                            {kw}
                          </button>
                        );
                      })}
                    </div>
                    <p className="zm-field-hint">
                      Antippen zum Hinzufügen — gilt für künftige Importe.
                    </p>
                  </div>
                )}

                {error && (
                  <p className="zm-status-error" role="alert">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  className="zm-btn zm-btn-primary"
                  disabled={busy}
                  onClick={() => void handleSave()}
                >
                  {busy ? "Speichern…" : "Speichern"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
