import {
  ArcElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { Doughnut, Line } from "react-chartjs-2";
import type { AnalysisCategorySlice } from "../features/analysis/types";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
  Filler,
);

const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

type TrendProps = {
  labels: string[];
  income: number[];
  expense: number[];
  showIncome: boolean;
  showExpense: boolean;
};

export function AnalysisTrendChart({
  labels,
  income,
  expense,
  showIncome,
  showExpense,
}: TrendProps) {
  if (labels.length === 0) {
    return <p className="zm-page-lead">Keine Daten für den Trend.</p>;
  }

  const datasets: {
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
    tension: number;
    fill: boolean;
  }[] = [];
  if (showIncome) {
    datasets.push({
      label: "Einnahmen",
      data: income,
      borderColor: "#15803d",
      backgroundColor: "rgba(21, 128, 61, 0.12)",
      tension: 0.25,
      fill: true,
    });
  }
  if (showExpense) {
    datasets.push({
      label: "Ausgaben",
      data: expense,
      borderColor: "#b91c1c",
      backgroundColor: "rgba(185, 28, 28, 0.1)",
      tension: 0.25,
      fill: true,
    });
  }

  return (
    <div className="zm-chart-box">
      <Line
        data={{ labels, datasets }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: "bottom" },
            tooltip: {
              callbacks: {
                label: (ctx) =>
                  `${ctx.dataset.label}: ${eur.format(Number(ctx.parsed.y))}`,
              },
            },
          },
          scales: {
            y: {
              ticks: {
                callback: (v) =>
                  typeof v === "number" ? eur.format(v) : String(v),
              },
            },
          },
        }}
      />
    </div>
  );
}

type PieProps = {
  slices: AnalysisCategorySlice[];
  emptyLabel: string;
  onSliceClick?: (id: number | null) => void;
};

export function AnalysisCategoryPie({
  slices,
  emptyLabel,
  onSliceClick,
}: PieProps) {
  if (slices.length === 0) {
    return <p className="zm-page-lead">{emptyLabel}</p>;
  }

  const amounts = slices.map((s) => Number(s.amount));
  const colors = slices.map((s) => s.color || "#78716c");

  return (
    <div className="zm-pie-layout">
      <div className="zm-chart-box zm-chart-box--pie">
        <Doughnut
          data={{
            labels: slices.map((s) => s.name),
            datasets: [
              {
                data: amounts,
                backgroundColor: colors,
                borderWidth: 1,
                borderColor: "rgba(255,252,248,0.9)",
              },
            ],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => {
                    const s = slices[ctx.dataIndex];
                    if (!s) return "";
                    return `${s.name}: ${eur.format(Number(s.amount))} (${s.percent} %)`;
                  },
                },
              },
            },
            onClick: (_evt, elements) => {
              if (!onSliceClick || elements.length === 0) return;
              const idx = elements[0]?.index;
              if (idx == null) return;
              const slice = slices[idx];
              if (slice) onSliceClick(slice.id);
            },
          }}
        />
      </div>
      <ul className="zm-pie-legend">
        {slices.map((s) => (
          <li key={`${s.id ?? "n"}-${s.name}`}>
            <button
              type="button"
              className="zm-pie-legend-btn"
              disabled={!onSliceClick || s.id == null}
              onClick={() => onSliceClick?.(s.id)}
            >
              <span
                className="zm-pie-swatch"
                style={{ background: s.color || "#78716c" }}
              />
              <span className="zm-pie-legend-name">{s.name}</span>
              <span className="zm-pie-legend-amt">
                {eur.format(Number(s.amount))} · {s.percent} %
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
