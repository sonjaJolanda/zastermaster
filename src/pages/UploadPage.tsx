import { useNavigate } from "react-router";
import { useState } from "react";
import { importBankFile } from "wasp/client/operations";
import { BalanceCalibrationModal } from "../components/BalanceCalibrationModal";
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
};

export function UploadPage() {
  const navigate = useNavigate();
  const [bank, setBank] = useState<BankId>("dkb");
  const [fileName, setFileName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMsg, setResultMsg] = useState<string | null>(null);
  const [pendingCalibration, setPendingCalibration] =
    useState<PendingCalibration | null>(null);

  function goHome() {
    navigate("/", { replace: false });
  }

  async function handleFile(file: File | null) {
    if (!file) return;
    setError(null);
    setResultMsg(null);
    setFileName(file.name);
    setBusy(true);
    try {
      const content = await file.text();
      const result = await importBankFile({
        bank,
        fileName: file.name,
        content,
      });
      setResultMsg(
        `${result.importedCount} neu importiert, ${result.duplicateCount} Duplikate übersprungen (${result.bank.toUpperCase()} · ${result.konto}).`,
      );
      if (result.needsBalanceCalibration) {
        setPendingCalibration({
          accountId: result.accountId,
          bank: result.bank,
          konto: result.konto,
          suggestedBalance: result.suggestedBalance,
        });
      } else {
        goHome();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Import fehlgeschlagen.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h1 className="zm-page-title">Upload</h1>
      <p className="zm-page-lead">
        Bankauszug wählen und importieren (DKB oder PayPal).
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
            <option value="dkb">DKB</option>
            <option value="paypal">PayPal</option>
          </select>
        </label>

        <label className="zm-dropzone">
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
            {busy ? "Import läuft…" : "Datei wählen"}
          </span>
          <span className="zm-dropzone-hint">
            {fileName ?? BANK_HINTS[bank]}
          </span>
        </label>

        {error && (
          <p className="zm-status-error" role="alert">
            {error}
          </p>
        )}
        {resultMsg && <p className="zm-status-ok">{resultMsg}</p>}
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
