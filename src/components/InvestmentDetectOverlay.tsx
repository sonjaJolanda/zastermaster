import { useEffect, useState } from "react";
import {
  confirmInvestment,
  detectInvestments,
  rejectInvestment,
} from "wasp/client/operations";
import type { InvestmentSuggestion } from "../features/investments/operations";
import { CloseIconButton } from "./PageChrome";

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

type OverlayState = "running" | "review" | "empty" | "error";

type Props = {
  onClose: () => void;
  onChanged: () => void;
};

export function InvestmentDetectOverlay({ onClose, onChanged }: Props) {
  const [state, setState] = useState<OverlayState>("running");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<InvestmentSuggestion[]>([]);
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [truncated, setTruncated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await detectInvestments();
        if (cancelled) return;
        setSuggestions(result.suggestions);
        setTruncated(result.truncated);
        setIndex(0);
        setState(result.suggestions.length === 0 ? "empty" : "review");
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Erkennung fehlgeschlagen.",
        );
        setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = suggestions[index] ?? null;

  async function advanceAfter(action: "confirm" | "reject") {
    if (!current) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "confirm") {
        await confirmInvestment({ transactionId: current.transactionId });
        onChanged();
      } else {
        await rejectInvestment({ transactionId: current.transactionId });
      }
      const next = index + 1;
      if (next >= suggestions.length) {
        onClose();
      } else {
        setIndex(next);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Aktion fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }

  const amount = current ? Number(current.betrag) : 0;
  const amountClass =
    amount > 0
      ? "zm-amount-income"
      : amount < 0
        ? "zm-amount-expense"
        : "";

  return (
    <div
      className="zm-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="zm-invest-title"
      onClick={onClose}
    >
      <div className="zm-overlay-anchor">
        <div
          className="zm-overlay-panel zm-related-panel"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="zm-overlay-header">
            <h2 id="zm-invest-title">Investitionen erkennen</h2>
            <CloseIconButton onClick={onClose} />
          </div>

          {state === "running" && (
            <div className="zm-related-progress" aria-live="polite">
              <div className="zm-related-spinner" aria-hidden />
              <p>Stichwörter prüfen…</p>
            </div>
          )}

          {state === "error" && (
            <div className="zm-related-progress">
              <p className="zm-status-error" role="alert">
                {error ?? "Erkennung fehlgeschlagen."}
              </p>
            </div>
          )}

          {state === "empty" && (
            <div className="zm-related-progress">
              <p className="zm-page-lead">
                Keine neuen Vorschläge. Stichwörter unter Einstellungen →
                Investitionen prüfen.
              </p>
            </div>
          )}

          {state === "review" && current && (
            <>
              <div className="zm-related-meta">
                <span className="zm-related-badge">
                  Stichwort: {current.matchedKeyword}
                </span>
                <span className="zm-page-lead">
                  {index + 1} / {suggestions.length}
                  {truncated ? " (gekürzt)" : ""}
                </span>
              </div>

              <div className="zm-related-leg">
                <dl className="zm-details-fields">
                  <div>
                    <dt>Id</dt>
                    <dd>{current.transactionId}</dd>
                  </div>
                  <div>
                    <dt>Datum</dt>
                    <dd>{dateDe.format(new Date(current.datum))}</dd>
                  </div>
                  <div>
                    <dt>Bank / Konto</dt>
                    <dd>
                      {current.bank.toUpperCase()} · {current.konto}
                    </dd>
                  </div>
                  <div>
                    <dt>Betrag</dt>
                    <dd className={amountClass}>{eur.format(amount)}</dd>
                  </div>
                  <div className="zm-details-full">
                    <dt>Verwendungszweck</dt>
                    <dd>{current.verwendungszweck || "—"}</dd>
                  </div>
                </dl>
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
                  onClick={() => void advanceAfter("reject")}
                >
                  Ablehnen
                </button>
                <button
                  type="button"
                  className="zm-btn zm-btn-primary"
                  disabled={busy}
                  onClick={() => void advanceAfter("confirm")}
                >
                  Als Investition bestätigen
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
