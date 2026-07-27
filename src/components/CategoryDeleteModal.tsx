import { useMemo, useState } from "react";
import { CloseIconButton } from "./PageChrome";
import { OverlayPortal } from "./OverlayPortal";
import type { CategoryTreeNode } from "../features/categories/types";

export type CategoryDeleteTarget = {
  kind: "category" | "subcategory";
  id: number;
  name: string;
  /** Subcategory ids that must not be offered as reassignment targets. */
  excludeSubcategoryIds: number[];
  txCount: number;
};

type Props = {
  target: CategoryDeleteTarget;
  categories: CategoryTreeNode[];
  busy: boolean;
  onClose: () => void;
  onConfirm: (reassignToSubcategoryId: number) => void;
};

export function CategoryDeleteModal({
  target,
  categories,
  busy,
  onClose,
  onConfirm,
}: Props) {
  const options = useMemo(() => {
    const out: { id: number; label: string }[] = [];
    for (const cat of categories) {
      for (const sub of cat.subcategories) {
        if (target.excludeSubcategoryIds.includes(sub.id)) continue;
        out.push({
          id: sub.id,
          label: `${cat.name} · ${sub.name}`,
        });
      }
    }
    return out;
  }, [categories, target.excludeSubcategoryIds]);

  const [targetSubId, setTargetSubId] = useState<number | "">(
    options[0]?.id ?? "",
  );

  const kindLabel =
    target.kind === "category" ? "Kategorie" : "Unterkategorie";

  return (
    <OverlayPortal>
      <div
        className="zm-overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby="zm-cat-delete-title"
        onClick={onClose}
      >
        <div className="zm-overlay-anchor">
          <div
            className="zm-overlay-panel zm-overlay-panel--narrow"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="zm-overlay-header">
              <h2 id="zm-cat-delete-title">{kindLabel} löschen</h2>
              <CloseIconButton onClick={onClose} disabled={busy} />
            </header>

            <p className="zm-page-lead">
              „{target.name}“ ist noch{" "}
              <strong>
                {target.txCount.toLocaleString("de-DE")} Transaktion
                {target.txCount === 1 ? "" : "en"}
              </strong>{" "}
              zugeordnet. Bitte eine Ziel-Unterkategorie wählen (beliebige
              Kategorie), in die diese Buchungen verschoben werden.
            </p>

            {options.length === 0 ? (
              <p className="zm-status-error" role="alert">
                Keine andere Unterkategorie verfügbar. Lege zuerst eine an.
              </p>
            ) : (
              <label className="zm-field">
                <span className="zm-field-label">Verschieben nach</span>
                <select
                  className="zm-select"
                  value={targetSubId === "" ? "" : String(targetSubId)}
                  disabled={busy}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTargetSubId(v ? Number(v) : "");
                  }}
                >
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="zm-btn-row" style={{ marginTop: "1rem" }}>
              <button
                type="button"
                className="zm-btn zm-btn-ghost"
                disabled={busy}
                onClick={onClose}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="zm-btn zm-btn-primary"
                disabled={busy || targetSubId === "" || options.length === 0}
                onClick={() => {
                  if (targetSubId === "") return;
                  onConfirm(targetSubId);
                }}
              >
                {busy ? "Löschen…" : "Verschieben & löschen"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
}
