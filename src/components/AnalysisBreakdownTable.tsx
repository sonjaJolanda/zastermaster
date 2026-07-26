import { Fragment, useState } from "react";
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
};

export function AnalysisBreakdownTable({
  title,
  rows,
  emptyLabel,
  onCategoryClick,
}: Props) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  if (rows.length === 0) {
    return (
      <section className="zm-analyse-section">
        <h2 className="zm-analyse-heading">{title}</h2>
        <p className="zm-page-lead">{emptyLabel}</p>
      </section>
    );
  }

  return (
    <section className="zm-analyse-section">
      <h2 className="zm-analyse-heading">{title}</h2>
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
                    <td className="zm-num">{eur.format(Number(row.amount))}</td>
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
                          <span className="zm-breakdown-indent">
                            {child.name}
                          </span>
                        </td>
                        <td className="zm-num">
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
    </section>
  );
}
