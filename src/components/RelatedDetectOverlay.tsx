import { useEffect, useState } from "react";
import {
  confirmRelatedPair,
  detectRelatedTransactions,
  rejectRelatedPair,
} from "wasp/client/operations";
import type {
  RelatedSuggestion,
  RelatedTxPublic,
} from "../features/related/types";

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

const STAGE_LABELS = [
  "Daten laden…",
  "PayPal ↔ Bank prüfen…",
  "Umbuchungen prüfen…",
  "Ähnliche Buchungen prüfen…",
  "Vorschläge aufbereiten…",
];

const TYPE_BADGE: Record<RelatedSuggestion["type"], string> = {
  paypal_bank: "PayPal↔Bank",
  transfer: "Umbuchung",
  near_duplicate: "Ähnlich",
};

type OverlayState = "running" | "review" | "empty" | "error";

type Props = {
  onClose: () => void;
  onChanged: () => void;
};

function scoreLabel(score: number): string {
  if (score >= 0.85) return "hoch";
  if (score >= 0.6) return "mittel";
  return "niedrig";
}

function LegCard({ tx }: { tx: RelatedTxPublic }) {
  const amount = Number(tx.betrag);
  const amountClass =
    amount > 0
      ? "zm-amount-income"
      : amount < 0
        ? "zm-amount-expense"
        : "";

  return (
    <div className="zm-related-leg">
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
          <dt>Bank</dt>
          <dd>{tx.bank.toUpperCase()}</dd>
        </div>
        <div>
          <dt>Konto</dt>
          <dd>{tx.konto}</dd>
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
          <dt>Betrag</dt>
          <dd className={amountClass}>{eur.format(amount)}</dd>
        </div>
        <div className="zm-details-full">
          <dt>Verwendungszweck</dt>
          <dd>{tx.verwendungszweck || "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

export function RelatedDetectOverlay({ onClose, onChanged }: Props) {
  const [state, setState] = useState<OverlayState>("running");
  const [stageIdx, setStageIdx] = useState(0);
  const [suggestions, setSuggestions] = useState<RelatedSuggestion[]>([]);
  const [index, setIndex] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setInterval(() => {
      setStageIdx((i) => Math.min(i + 1, STAGE_LABELS.length - 1));
    }, 900);

    void (async () => {
      try {
        const result = await detectRelatedTransactions();
        if (cancelled) return;
        setTruncated(result.truncated);
        if (result.suggestions.length === 0) {
          setSuggestions([]);
          setState("empty");
        } else {
          setSuggestions(result.suggestions);
          setIndex(0);
          setState("review");
        }
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setState("error");
      } finally {
        window.clearInterval(timer);
      }
    })();

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const current = suggestions[index] ?? null;
  const remaining = suggestions.length;

  function removeCurrent() {
    setSuggestions((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setState("empty");
        setIndex(0);
        return next;
      }
      setIndex((i) => Math.min(i, next.length - 1));
      return next;
    });
  }

  async function handleConfirm() {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await confirmRelatedPair({
        aId: current.a.id,
        bId: current.b.id,
        type: current.type,
      });
      onChanged();
      removeCurrent();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      await rejectRelatedPair({
        aId: current.a.id,
        bId: current.b.id,
      });
      removeCurrent();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="zm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zm-related-title"
      onClick={onClose}
    >
      <div className="zm-overlay-anchor">
        <div
          className="zm-overlay-panel zm-related-panel"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="zm-overlay-header">
          <h2 id="zm-related-title">Zusammengehörige Transaktionen</h2>
          <button
            type="button"
            className="zm-btn zm-btn-ghost"
            onClick={onClose}
          >
            Schließen
          </button>
        </div>

        {state === "running" && (
          <div className="zm-related-progress" aria-live="polite">
            <div className="zm-related-spinner" aria-hidden />
            <p>{STAGE_LABELS[stageIdx]}</p>
            <p className="zm-page-lead">Bitte warten…</p>
          </div>
        )}

        {state === "error" && (
          <div className="zm-related-progress">
            <p className="zm-status-error" role="alert">
              {error ?? "Erkennung fehlgeschlagen."}
            </p>
            <button type="button" className="zm-btn zm-btn-primary" onClick={onClose}>
              Schließen
            </button>
          </div>
        )}

        {state === "empty" && (
          <div className="zm-related-progress">
            <p className="zm-page-lead">Keine neuen Vorschläge.</p>
            <button type="button" className="zm-btn zm-btn-primary" onClick={onClose}>
              Schließen
            </button>
          </div>
        )}

        {state === "review" && current && (
          <>
            <div className="zm-related-meta">
              <span className="zm-related-badge">
                {TYPE_BADGE[current.type]}
              </span>
              <span className="zm-page-lead">
                Trefferqualität: {scoreLabel(current.score)}
              </span>
              <span className="zm-page-lead">
                {index + 1} / {remaining}
                {truncated ? " (Liste gekürzt)" : ""}
              </span>
            </div>
            <p className="zm-related-reason">{current.reason}</p>

            <div className="zm-related-pair">
              <LegCard tx={current.a} />
              <LegCard tx={current.b} />
            </div>

            {error && (
              <p className="zm-status-error" role="alert">
                {error}
              </p>
            )}

            <div className="zm-btn-row">
              <button
                type="button"
                className="zm-btn zm-btn-ghost"
                disabled={busy}
                onClick={() => void handleReject()}
              >
                Ablehnen
              </button>
              <button
                type="button"
                className="zm-btn zm-btn-primary"
                disabled={busy}
                onClick={() => void handleConfirm()}
              >
                {busy ? "Speichern…" : "Bestätigen"}
              </button>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
