import {
  TX_COLUMN_DEFS,
  TX_COLUMNS_STORAGE_KEY,
  type TxColumnKey,
} from "./types";

export type ColumnVisibility = Record<TxColumnKey, boolean>;

export function defaultColumnVisibility(): ColumnVisibility {
  const out = {} as ColumnVisibility;
  for (const col of TX_COLUMN_DEFS) {
    out[col.key] = col.defaultVisible;
  }
  return out;
}

export function loadColumnVisibility(): ColumnVisibility {
  const defaults = defaultColumnVisibility();
  try {
    const raw = localStorage.getItem(TX_COLUMNS_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Record<TxColumnKey, boolean>>;
    const out = { ...defaults };
    for (const col of TX_COLUMN_DEFS) {
      if (typeof parsed[col.key] === "boolean") {
        out[col.key] = parsed[col.key]!;
      }
    }
    return out;
  } catch {
    return defaults;
  }
}

export function saveColumnVisibility(vis: ColumnVisibility): void {
  try {
    localStorage.setItem(TX_COLUMNS_STORAGE_KEY, JSON.stringify(vis));
  } catch {
    // ignore quota / private mode
  }
}
