import type {
  AnalysisGrouping,
  AnalysisTimeSeries,
  AnalysisTimeSeriesPoint,
} from "./types";

export type SeriesRow = {
  id: number;
  datum: Date;
  betrag: number;
  isInvestment?: boolean;
};

export function autoGrouping(
  dateFrom: Date,
  dateTo: Date,
): AnalysisGrouping {
  const days =
    Math.floor((dateTo.getTime() - dateFrom.getTime()) / 86_400_000) + 1;
  // Up to ~1 calendar year: daily points so trends within/between months are visible.
  if (days <= 400) return "day";
  if (days <= 365 * 3) return "month";
  return "year";
}

export function enumeratePeriodKeys(
  dateFrom: Date,
  dateTo: Date,
  grouping: AnalysisGrouping,
): string[] {
  const keys: string[] = [];
  if (grouping === "day") {
    const cur = new Date(dateFrom.getTime());
    while (cur.getTime() <= dateTo.getTime()) {
      keys.push(periodKey(cur, "day"));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return keys;
  }
  if (grouping === "month") {
    const cur = new Date(
      Date.UTC(dateFrom.getUTCFullYear(), dateFrom.getUTCMonth(), 1),
    );
    const end = new Date(
      Date.UTC(dateTo.getUTCFullYear(), dateTo.getUTCMonth(), 1),
    );
    while (cur.getTime() <= end.getTime()) {
      keys.push(periodKey(cur, "month"));
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
    return keys;
  }
  for (let y = dateFrom.getUTCFullYear(); y <= dateTo.getUTCFullYear(); y++) {
    keys.push(String(y));
  }
  return keys;
}

export function periodKey(d: Date, grouping: AnalysisGrouping): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  if (grouping === "day") return `${y}-${m}-${day}`;
  if (grouping === "month") return `${y}-${m}`;
  return String(y);
}

export function fillSeriesBuckets(
  dateFrom: Date,
  dateTo: Date,
  grouping: AnalysisGrouping,
  rows: SeriesRow[],
  drop: Set<number>,
): Map<string, { income: number; expense: number; invested: number }> {
  const buckets = new Map<
    string,
    { income: number; expense: number; invested: number }
  >();
  for (const key of enumeratePeriodKeys(dateFrom, dateTo, grouping)) {
    buckets.set(key, { income: 0, expense: 0, invested: 0 });
  }
  for (const row of rows) {
    if (drop.has(row.id)) continue;
    const key = periodKey(row.datum, grouping);
    let b = buckets.get(key);
    if (!b) {
      b = { income: 0, expense: 0, invested: 0 };
      buckets.set(key, b);
    }
    if (row.betrag > 0) b.income += row.betrag;
    else if (row.betrag < 0) {
      const abs = Math.abs(row.betrag);
      b.expense += abs;
      if (row.isInvestment) b.invested += abs;
    }
  }
  return buckets;
}

export function toSeriesPoints(
  buckets: Map<string, { income: number; expense: number; invested: number }>,
  grouping: AnalysisGrouping,
): AnalysisTimeSeriesPoint[] {
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, v]) => ({
      period,
      label: periodLabel(period, grouping),
      income: v.income.toFixed(2),
      expense: v.expense.toFixed(2),
      invested: v.invested.toFixed(2),
    }));
}

export function periodLabel(key: string, grouping: AnalysisGrouping): string {
  if (grouping === "year") return key;
  if (grouping === "month") {
    const [y, m] = key.split("-");
    const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
    return d.toLocaleDateString("de-DE", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  const [y, m, day] = key.split("-");
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, Number(day)));
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

/** Prefer server monthly buckets; otherwise roll daily trend points up to months. */
export function resolveMonthlyPoints(
  series:
    | (Pick<AnalysisTimeSeries, "grouping" | "points"> & {
        monthlyPoints?: AnalysisTimeSeriesPoint[];
      })
    | null
    | undefined,
): AnalysisTimeSeriesPoint[] {
  if (!series) return [];
  if (series.monthlyPoints && series.monthlyPoints.length > 0) {
    return series.monthlyPoints;
  }
  if (series.grouping === "month") return series.points;
  if (series.grouping !== "day") return [];
  return aggregateDailyPointsToMonths(series.points);
}

export function aggregateDailyPointsToMonths(
  points: AnalysisTimeSeriesPoint[],
): AnalysisTimeSeriesPoint[] {
  const buckets = new Map<
    string,
    { income: number; expense: number; invested: number }
  >();
  for (const p of points) {
    const month = p.period.length >= 7 ? p.period.slice(0, 7) : p.period;
    let b = buckets.get(month);
    if (!b) {
      b = { income: 0, expense: 0, invested: 0 };
      buckets.set(month, b);
    }
    b.income += Number(p.income);
    b.expense += Number(p.expense);
    b.invested += Number(p.invested ?? 0);
  }
  return toSeriesPoints(buckets, "month");
}
