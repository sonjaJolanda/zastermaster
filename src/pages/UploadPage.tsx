import { useNavigate } from "react-router";
import { useEffect, useRef, useState } from "react";
import { importBankFile } from "wasp/client/operations";
import { BalanceCalibrationModal } from "../components/BalanceCalibrationModal";
import { useImportLock } from "../features/import/ImportLockContext";
import type { BankId } from "../features/import/types";

type PendingCalibration = {
  accountId: number;
  bank: string;
  konto: string;
  suggestedBalance: string | null;
};

const BANK_HINTS: Record<BankId, string> = {
  dkb: "DKB-CSV (Girokonto / Tagesgeld, Semikolon)",
  paypal: "PayPal-TXT/TSV (Aktivitätsexport)",
  sparkasse: "Sparkasse MT940-TXT (:61:/:86:)",
  traderepublic: "Trade Republic transactions CSV",
};

const BANK_LABELS: Record<BankId, string> = {
  dkb: "DKB",
  paypal: "PayPal",
  sparkasse: "Sparkasse",
  traderepublic: "Trade Republic",
};

const PROGRESS_STAGES = [
  { max: 20, label: "Datei lesen…" },
  { max: 45, label: "Datei prüfen…" },
  { max: 92, label: "Buchungen speichern…" },
  { max: 100, label: "Abschluss…" },
] as const;

function stageLabel(pct: number): string {
  for (const s of PROGRESS_STAGES) {
    if (pct <= s.max) return s.label;
  }
  return "Abschluss…";
}

export function UploadPage() {
  const navigate = useNavigate();
  const { setImportLocked } = useImportLock();
  const [bank, setBank] = useState<BankId>("dkb");
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pendingCalibration, setPendingCalibration] =
    useState<PendingCalibration | null>(null);
  const progressTimer = useRef<number | null>(null);

  function goHome() {
    navigate("/", { replace: false });
  }

  function clearProgressTimer() {
    if (progressTimer.current != null) {
      window.clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }

  useEffect(() => {
    return () => {
      clearProgressTimer();
      setImportLocked(false);
    };
  }, [setImportLocked]);

  function startProgress() {
    clearProgressTimer();
    setProgress(8);
    progressTimer.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        return Math.min(90, p + (p < 40 ? 4 : 2));
      });
    }, 280);
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setWarnings([]);
    setResultMsg(null);
    setFileName(file.name);
    setBusy(true);
    setImportLocked(true);
    startProgress();

    try {
      if (file.size > 12_000_000) {
        throw new Error(
          "Datei ist zu groß (max. ca. 12 MB). Bitte Zeitraum im Export verkleinern.",
        );
      }
      const content = await file.text();
      setProgress((p) => Math.max(p, 25));
      const result = await importBankFile({
        bank,
        fileName: file.name,
        content,
      });
      clearProgressTimer();
      setProgress(100);
      const parts = [
        `${result.importedCount} neu`,
        `${result.duplicateCount} Duplikate`,
      ];
      if (result.skippedRows > 0) {
        parts.push(`${result.skippedRows} übersprungen`);
      }
      setResultMsg(
        `${parts.join(", ")} (${result.bank.toUpperCase()} · ${result.konto}).`,
      );
      setWarnings(result.warnings ?? []);
      if (result.needsBalanceCalibration) {
        setPendingCalibration({
          accountId: result.accountId,
          bank: result.bank,
          konto: result.konto,
          suggestedBalance: result.suggestedBalance,
        });
      } else {
        window.setTimeout(() => goHome(), 450);
      }
    } catch (err) {
      clearProgressTimer();
      setProgress(0);
      setError(
        err instanceof Error ? err.message : "Import fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
      setImportLocked(false);
    }
  }

  return (
    <section>
      <h1 className="zm-page-title">Upload</h1>
      <p className="zm-page-lead">
        Bankauszug wählen und importieren (DKB, PayPal, Sparkasse, Trade
        Republic). Während des Imports ist die Navigation gesperrt.
      </p>

      <div className="zm-upload">
        <label className="zm-field">
          <span className="zm-field-label">Bank</span>
          <select
            className="zm-select"
            value={bank}
            disabled={busy}
            onChange={(e) => setBank(e.target.value as BankId)}
          >
            {(Object.keys(BANK_LABELS) as BankId[]).map((id) => (
              <option key={id} value={id}>
                {BANK_LABELS[id]}
              </option>
            ))}
          </select>
        </label>

        <label
          className={`zm-dropzone${dragOver ? " is-dragover" : ""}${busy ? " is-busy" : ""}`}
          onDragEnter={(e) => {
            e.preventDefault();
            if (!busy) setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            if (!busy) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (busy) return;
            void handleFile(e.dataTransfer.files?.[0] ?? null);
          }}
        >
          <input
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            disabled={busy}
            onChange={(e) => {
              void handleFile(e.target.files?.[0] ?? null);
              e.target.value = "";
            }}
          />
          <span className="zm-dropzone-title">
            {busy ? stageLabel(progress) : "Datei wählen oder ablegen"}
          </span>
          <span className="zm-dropzone-hint">
            {fileName ?? BANK_HINTS[bank]}
          </span>
        </label>

        {busy && (
          <div
            className="zm-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            aria-label="Importfortschritt"
          >
            <div
              className="zm-progress-bar"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}

        {error && (
          <p className="zm-status-error" role="alert">
            {error}
          </p>
        )}
        {resultMsg && <p className="zm-status-ok">{resultMsg}</p>}
        {warnings.length > 0 && (
          <ul className="zm-upload-warnings">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </div>

      {pendingCalibration && (
        <BalanceCalibrationModal
          accountId={pendingCalibration.accountId}
          bank={pendingCalibration.bank}
          konto={pendingCalibration.konto}
          suggestedBalance={pendingCalibration.suggestedBalance}
          onDone={() => {
            setPendingCalibration(null);
            goHome();
          }}
          onSkip={() => {
            setPendingCalibration(null);
            goHome();
          }}
        />
      )}
    </section>
  );
}
