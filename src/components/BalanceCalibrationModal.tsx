import { useState } from "react";
import { setAccountBalance } from "wasp/client/operations";
import { defaultAccountColor } from "../features/accounts/colors";
import { CloseIconButton } from "./PageChrome";
import { OverlayPortal } from "./OverlayPortal";

type Props = {
  accountId: number;
  bank: string;
  konto: string;
  suggestedBalance: string | null;
  /** Current badge color (resolved); defaults from bank if omitted. */
  color?: string;
  onDone: () => void;
  onSkip: () => void;
};

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatSuggestion(raw: string | null): string {
  if (!raw) return "";
  const n = Number(raw);
  if (Number.isNaN(n)) return "";
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function BalanceCalibrationModal({
  accountId,
  bank,
  konto,
  suggestedBalance,
  color: initialColor,
  onDone,
  onSkip,
}: Props) {
  const [balance, setBalance] = useState(formatSuggestion(suggestedBalance));
  const [asOfDate, setAsOfDate] = useState(todayIso());
  const [color, setColor] = useState(
    initialColor || defaultAccountColor(bank),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      await setAccountBalance({
        accountId,
        currentBalance: balance,
        asOfDate,
        color,
      });
      onDone();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Kontostand konnte nicht gespeichert werden.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <OverlayPortal>
      <div
        className="zm-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="zm-balance-title"
      >
        <div className="zm-overlay-anchor">
          <div className="zm-overlay-panel zm-overlay-panel--narrow">
            <header className="zm-overlay-header">
              <h2 id="zm-balance-title">Konto bearbeiten</h2>
              <CloseIconButton disabled={busy} onClick={onSkip} />
            </header>
          <p className="zm-page-lead">
            <strong>
              {bank.toUpperCase()} · {konto}
            </strong>
          </p>

          <div className="zm-upload zm-upload--modal">
            <label className="zm-field">
              <span className="zm-field-label">Farbe (Bank-Badge)</span>
              <input
                className="zm-input zm-input-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                aria-label="Kontenfarbe"
              />
            </label>
            <label className="zm-field">
              <span className="zm-field-label">Aktueller Kontostand (€)</span>
              <input
                className="zm-input"
                inputMode="decimal"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="z. B. 4.046,97"
                autoFocus
              />
            </label>
            <label className="zm-field">
              <span className="zm-field-label">Stand vom</span>
              <input
                className="zm-input"
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
              />
            </label>

            {error && (
              <p className="zm-status-error" role="alert">
                {error}
              </p>
            )}

            <div className="zm-btn-row">
              <button
                type="button"
                className="zm-btn zm-btn-primary"
                disabled={busy || !balance.trim()}
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
