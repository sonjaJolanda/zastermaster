import {
  forwardRef,
  useImperativeHandle,
  useRef,
} from "react";
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
  type Chart,
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

export type ChartExportHandle = {
  toDataUrl: () => string | null;
};

type TrendProps = {
  labels: string[];
  income: number[];
  expense: number[];
  showIncome: boolean;
  showExpense: boolean;
};

export const AnalysisTrendChart = forwardRef<ChartExportHandle, TrendProps>(
  function AnalysisTrendChart(
    { labels, income, expense, showIncome, showExpense },
    ref,
  ) {
    const chartRef = useRef<Chart<"line"> | null>(null);

    useImperativeHandle(ref, () => ({
      toDataUrl: () => {
        const chart = chartRef.current;
        if (!chart) return null;
        try {
          return chart.toBase64Image("image/png", 1);
        } catch {
          return null;
        }
      },
    }));

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
      pointRadius: number;
      pointHoverRadius: number;
      borderWidth: number;
    }[] = [];
    if (showIncome) {
      datasets.push({
        label: "Einnahmen",
        data: income,
        borderColor: "#15803d",
        backgroundColor: "rgba(21, 128, 61, 0.12)",
        tension: 0.15,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 3,
        borderWidth: 2,
      });
    }
    if (showExpense) {
      datasets.push({
        label: "Ausgaben",
        data: expense,
        borderColor: "#b91c1c",
        backgroundColor: "rgba(185, 28, 28, 0.1)",
        tension: 0.15,
        fill: true,
        pointRadius: 0,
        pointHoverRadius: 3,
        borderWidth: 2,
      });
    }

    return (
      <div className="zm-chart-box">
        <Line
          ref={chartRef}
          data={{ labels, datasets }}
          options={{
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
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
              x: {
                ticks: {
                  autoSkip: true,
                  maxTicksLimit: 12,
                  maxRotation: 0,
                },
              },
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
  },
);

type PieProps = {
  slices: AnalysisCategorySlice[];
  emptyLabel: string;
  onSliceClick?: (id: number | null) => void;
};

export const AnalysisCategoryPie = forwardRef<ChartExportHandle, PieProps>(
  function AnalysisCategoryPie({ slices, emptyLabel, onSliceClick }, ref) {
    const chartRef = useRef<Chart<"doughnut"> | null>(null);

    useImperativeHandle(ref, () => ({
      toDataUrl: () => {
        const chart = chartRef.current;
        if (!chart) return null;
        try {
          return chart.toBase64Image("image/png", 1);
        } catch {
          return null;
        }
      },
    }));

    if (slices.length === 0) {
      return <p className="zm-page-lead">{emptyLabel}</p>;
    }

    const amounts = slices.map((s) => Math.abs(Number(s.amount)));
    const colors = slices.map((s) => s.color || "#78716c");

    return (
      <div className="zm-pie-layout">
        <div className="zm-chart-box zm-chart-box--pie">
          <Doughnut
            ref={chartRef}
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
              animation: false,
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
          {slices.map((s) => {
            const n = Number(s.amount);
            const amtClass =
              n > 0
                ? "zm-amount-income"
                : n < 0
                  ? "zm-amount-expense"
                  : "";
            return (
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
                  <span className={`zm-pie-legend-amt ${amtClass}`.trim()}>
                    {eur.format(n)} · {s.percent} %
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  },
);
