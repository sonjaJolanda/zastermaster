import { useEffect, useMemo, useState } from "react";
import {
  categorizeTransaction,
  getCategories,
  useQuery,
} from "wasp/client/operations";
import type { TransactionListItem } from "../features/transactions/types";

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

  // Reset form when switching to another row (e.g. related-partner link).
  useEffect(() => {
    setCategoryId(tx.categoryId ?? "");
    setSubcategoryId(tx.subcategoryId ?? "");
    setError(null);
  }, [tx.id, tx.categoryId, tx.subcategoryId]);

  const subs = useMemo(() => {
    if (!categories || categoryId === "") return [];
    return (
      categories.find((c) => c.id === categoryId)?.subcategories ?? []
    );
  }, [categories, categoryId]);

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

  const amount = Number(tx.betrag);

  return (
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
          <button
            type="button"
            className="zm-btn zm-btn-ghost"
            onClick={onClose}
          >
            Schließen
          </button>
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
            <div>
              <dt>Verknüpfung</dt>
              <dd>
                {tx.relatedTransactionId != null
                  ? `#${tx.relatedTransactionId}`
                  : "—"}
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
          </dl>

          <div className="zm-details-cat">
            <h3>Kategorisieren</h3>
            {tx.relatedTransactionId != null && (
              <p className="zm-page-lead">
                Speichern gilt auch für die verknüpfte Transaktion #
                {tx.relatedTransactionId}.
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
                value={subcategoryId === "" ? "" : String(subcategoryId)}
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
  );
}
