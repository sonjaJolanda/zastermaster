/** Shared date-range presets for Analyse + Transaktionen filters. */

export type DatePreset =
  | "year"
  | "lastYear"
  | "month"
  | "lastMonth"
  | "monthBeforeLast"
  | "last3Months"
  | "all"
  | "custom";

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function yearStart(year: number): string {
  return `${year}-01-01`;
}

export function monthRange(now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const from = new Date(y, m, 1);
  return { from: isoDate(from), to: isoDate(now) };
}

export function defaultYearRange(now = new Date()): { from: string; to: string } {
  return { from: yearStart(now.getFullYear()), to: isoDate(now) };
}

export function lastYearRange(now = new Date()): { from: string; to: string } {
  const y = now.getFullYear() - 1;
  return { from: yearStart(y), to: `${y}-12-31` };
}

export function lastMonthRange(now = new Date()): { from: string; to: string } {
  const firstThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastPrev = new Date(firstThisMonth.getTime() - 86_400_000);
  const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
  return { from: isoDate(firstPrev), to: isoDate(lastPrev) };
}

/** Full calendar month before last month (e.g. in July → May 1–31). */
export function monthBeforeLastRange(
  now = new Date(),
): { from: string; to: string } {
  const first = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  const last = new Date(now.getFullYear(), now.getMonth() - 1, 0);
  return { from: isoDate(first), to: isoDate(last) };
}

/** Current month + previous two calendar months, through today. */
export function last3MonthsRange(now = new Date()): { from: string; to: string } {
  const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return { from: isoDate(from), to: isoDate(now) };
}

export function rangeForPreset(
  preset: Exclude<DatePreset, "custom" | "all">,
  now = new Date(),
): { from: string; to: string } {
  switch (preset) {
    case "year":
      return defaultYearRange(now);
    case "lastYear":
      return lastYearRange(now);
    case "month":
      return monthRange(now);
    case "lastMonth":
      return lastMonthRange(now);
    case "monthBeforeLast":
      return monthBeforeLastRange(now);
    case "last3Months":
      return last3MonthsRange(now);
  }
}

/** Chip labels shared by Analyse (no „Alle Zeiten“) and Transaktionen. */
export const DATE_PRESET_CHIPS: {
  key: DatePreset;
  label: string;
  analyse?: boolean;
  transactions?: boolean;
}[] = [
  { key: "year", label: "Dieses Jahr", analyse: true, transactions: true },
  { key: "lastYear", label: "Letztes Jahr", analyse: true, transactions: true },
  { key: "month", label: "Dieser Monat", analyse: true, transactions: true },
  {
    key: "lastMonth",
    label: "Letzter Monat",
    analyse: true,
    transactions: true,
  },
  {
    key: "monthBeforeLast",
    label: "Vorletzter Monat",
    analyse: true,
    transactions: true,
  },
  {
    key: "last3Months",
    label: "Letzte 3 Monate",
    analyse: true,
    transactions: true,
  },
  { key: "all", label: "Alle Zeiten", transactions: true },
  { key: "custom", label: "Benutzerdefiniert", analyse: true, transactions: true },
];
