import {
  rangeForPreset,
  type DatePreset,
} from "../dates/presets";

const PRESETS: DatePreset[] = [
  "year",
  "lastYear",
  "month",
  "lastMonth",
  "monthBeforeLast",
  "last3Months",
  "all",
  "custom",
];

export const TX_FILTERS_STORAGE_KEY = "zm-tx-filters-v1";
export const ANALYSE_FILTERS_STORAGE_KEY = "zm-analyse-filters-v1";

export type PersistedTxFilters = {
  banks: string[];
  konten: string[];
  typ: string;
  categorySource: string;
  categoryId: number | null;
  subcategoryId: number | null;
  includeBalanceAdjustments: boolean;
  preset: DatePreset;
  dateFrom: string;
  dateTo: string;
  search: string;
  pageSize: number;
};

export type PersistedAnalyseFilters = {
  banks: string[];
  konten: string[];
  typ: string;
  categoryId: number | null;
  subcategoryId: number | null;
  preset: DatePreset;
  dateFrom: string;
  dateTo: string;
};

function isPreset(raw: unknown): raw is DatePreset {
  return typeof raw === "string" && (PRESETS as string[]).includes(raw);
}

function asStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

function asNullableId(raw: unknown): number | null {
  if (raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Relative presets recompute dates on load; custom/all keep stored bounds. */
export function resolveStoredDates(
  presetRaw: unknown,
  dateFromRaw: unknown,
  dateToRaw: unknown,
  fallback: { preset: DatePreset; dateFrom: string; dateTo: string },
): { preset: DatePreset; dateFrom: string; dateTo: string } {
  const preset = isPreset(presetRaw) ? presetRaw : fallback.preset;
  if (preset === "custom") {
    return {
      preset,
      dateFrom: typeof dateFromRaw === "string" ? dateFromRaw : "",
      dateTo: typeof dateToRaw === "string" ? dateToRaw : "",
    };
  }
  if (preset === "all") {
    return { preset, dateFrom: "", dateTo: "" };
  }
  const r = rangeForPreset(preset);
  return { preset, dateFrom: r.from, dateTo: r.to };
}

function readJson(key: string): unknown | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota / private mode
  }
}

export function loadTxFilters(
  defaults: PersistedTxFilters,
): PersistedTxFilters {
  if (typeof window === "undefined") return defaults;
  const parsed = readJson(TX_FILTERS_STORAGE_KEY);
  if (!parsed || typeof parsed !== "object") return defaults;
  const o = parsed as Record<string, unknown>;
  const dates = resolveStoredDates(
    o.preset,
    o.dateFrom,
    o.dateTo,
    {
      preset: defaults.preset,
      dateFrom: defaults.dateFrom,
      dateTo: defaults.dateTo,
    },
  );
  const pageSizeRaw =
    typeof o.pageSize === "number" && o.pageSize > 0
      ? o.pageSize
      : defaults.pageSize;
  const pageSize = ([50, 100, 250, 500] as const).includes(
    pageSizeRaw as 50 | 100 | 250 | 500,
  )
    ? pageSizeRaw
    : defaults.pageSize;

  return {
    banks: asStringArray(o.banks),
    konten: asStringArray(o.konten),
    typ: typeof o.typ === "string" ? o.typ : defaults.typ,
    categorySource:
      typeof o.categorySource === "string"
        ? o.categorySource
        : defaults.categorySource,
    categoryId: asNullableId(o.categoryId),
    subcategoryId: asNullableId(o.subcategoryId),
    includeBalanceAdjustments: Boolean(o.includeBalanceAdjustments),
    search: typeof o.search === "string" ? o.search : "",
    pageSize,
    ...dates,
  };
}

export function saveTxFilters(filters: PersistedTxFilters): void {
  writeJson(TX_FILTERS_STORAGE_KEY, filters);
}

export function loadAnalyseFilters(
  defaults: PersistedAnalyseFilters,
): PersistedAnalyseFilters {
  if (typeof window === "undefined") return defaults;
  const parsed = readJson(ANALYSE_FILTERS_STORAGE_KEY);
  if (!parsed || typeof parsed !== "object") return defaults;
  const o = parsed as Record<string, unknown>;
  const dates = resolveStoredDates(
    o.preset,
    o.dateFrom,
    o.dateTo,
    {
      preset: defaults.preset,
      dateFrom: defaults.dateFrom,
      dateTo: defaults.dateTo,
    },
  );
  return {
    banks: asStringArray(o.banks),
    konten: asStringArray(o.konten),
    typ: typeof o.typ === "string" ? o.typ : defaults.typ,
    categoryId: asNullableId(o.categoryId),
    subcategoryId: asNullableId(o.subcategoryId),
    ...dates,
  };
}

export function saveAnalyseFilters(filters: PersistedAnalyseFilters): void {
  writeJson(ANALYSE_FILTERS_STORAGE_KEY, filters);
}
