import { Fragment, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { AnalysisBreakdownRow } from "../features/analysis/types";

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

type Props = {
  title: string;
  rows: AnalysisBreakdownRow[];
  emptyLabel: string;
  onCategoryClick?: (id: number | null) => void;
  /** When true, color amounts as income/expense by sign (net breakdown). */
  signedAmounts?: boolean;
  /** Initial open state for the whole section (default: collapsed). */
  defaultOpen?: boolean;
};

function amountClass(raw: string, signed: boolean | undefined): string {
  if (!signed) return "zm-num";
  const n = Number(raw);
  if (n > 0) return "zm-num zm-amount-income";
  if (n < 0) return "zm-num zm-amount-expense";
  return "zm-num";
}

export function AnalysisBreakdownTable({
  title,
  rows,
  emptyLabel,
  onCategoryClick,
  signedAmounts,
  defaultOpen = false,
}: Props) {
  const [sectionOpen, setSectionOpen] = useState(defaultOpen);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <section className="zm-analyse-section zm-breakdown-section">
      <button
        type="button"
        className="zm-analyse-heading-toggle"
        aria-expanded={sectionOpen}
        onClick={() => setSectionOpen((o) => !o)}
      >
        <h2 className="zm-analyse-heading">{title}</h2>
        {sectionOpen ? (
          <ChevronUp size={18} aria-hidden />
        ) : (
          <ChevronDown size={18} aria-hidden />
        )}
      </button>

      {sectionOpen &&
        (rows.length === 0 ? (
          <p className="zm-page-lead">{emptyLabel}</p>
        ) : (
          <div className="zm-table-wrap">
            <table className="zm-table zm-breakdown-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th className="zm-num">Betrag</th>
                  <th className="zm-num">Anteil</th>
                  <th className="zm-num">Buchungen</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const key = `${row.id ?? "n"}-${row.name}`;
                  const expanded = open[key] ?? false;
                  const hasChildren = row.children.length > 0;
                  return (
                    <Fragment key={key}>
                      <tr>
                        <td>
                          <div className="zm-breakdown-name">
                            {hasChildren && (
                              <button
                                type="button"
                                className="zm-breakdown-toggle"
                                aria-expanded={expanded}
                                onClick={() =>
                                  setOpen((prev) => ({
                                    ...prev,
                                    [key]: !expanded,
                                  }))
                                }
                              >
                                {expanded ? "▾" : "▸"}
                              </button>
                            )}
                            <span
                              className="zm-pie-swatch"
                              style={{ background: row.color || "#78716c" }}
                            />
                            {onCategoryClick && row.id != null ? (
                              <button
                                type="button"
                                className="zm-linkish"
                                onClick={() => onCategoryClick(row.id)}
                              >
                                {row.name}
                              </button>
                            ) : (
                              row.name
                            )}
                          </div>
                        </td>
                        <td className={amountClass(row.amount, signedAmounts)}>
                          {eur.format(Number(row.amount))}
                        </td>
                        <td className="zm-num">{row.percent} %</td>
                        <td className="zm-num">
                          {row.count.toLocaleString("de-DE")}
                        </td>
                      </tr>
                      {expanded &&
                        row.children.map((child) => (
                          <tr
                            key={`${key}-c-${child.id ?? "n"}-${child.name}`}
                            className="zm-breakdown-child"
                          >
                            <td>
                              <div className="zm-breakdown-name zm-breakdown-indent">
                                <span
                                  className="zm-pie-swatch"
                                  style={{
                                    background: child.color || "#78716c",
                                  }}
                                />
                                {child.name}
                              </div>
                            </td>
                            <td
                              className={amountClass(
                                child.amount,
                                signedAmounts,
                              )}
                            >
                              {eur.format(Number(child.amount))}
                            </td>
                            <td className="zm-num">{child.percent} %</td>
                            <td className="zm-num">
                              {child.count.toLocaleString("de-DE")}
                            </td>
                          </tr>
                        ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
    </section>
  );
}
