export type CategorySource = "manual" | "learned" | "keyword" | "none";

export type TransactionTyp = "all" | "income" | "expense";

export type CategorySourceFilter = CategorySource | "all";

export type TransactionListItem = {
  id: number;
  datum: string;
  betrag: string;
  sender: string;
  empfaenger: string;
  verwendungszweck: string;
  iban: string;
  kundenreferenz: string;
  bank: string;
  konto: string;
  categoryId: number | null;
  subcategoryId: number | null;
  categoryName: string | null;
  subcategoryName: string | null;
  /** Main category color for table swatch. */
  categoryColor: string | null;
  confidenceScore: number;
  categorySource: CategorySource;
  relatedTransactionId: number | null;
  relatedGroupId: string | null;
  /** Sibling ids in the related group (excludes self). */
  relatedIds: number[];
  relatedType:
    | "paypal_bank"
    | "paypal_purchase"
    | "transfer"
    | "near_duplicate"
    | null;
  /** Confirmed investment — still counts in flow totals; badge + Investiert strip. */
  isInvestment: boolean;
};

export type TransactionFilterArgs = {
  page?: number;
  pageSize?: number;
  banks?: string[];
  konten?: string[];
  typ?: TransactionTyp;
  /** Filter by Konfidenz / categorySource. */
  categorySource?: CategorySourceFilter;
  /** When true, include Saldo-Kalibrierung / balance-adjustment rows. */
  includeBalanceAdjustments?: boolean;
  /** Inclusive YYYY-MM-DD; empty = no lower bound. */
  dateFrom?: string;
  /** Inclusive YYYY-MM-DD; empty = no upper bound. */
  dateTo?: string;
  /** Free text over Verwendungszweck, Sender, Empfänger. */
  search?: string;
  /** Filter by main category id. */
  categoryId?: number | null;
  /** Filter by subcategory id (implies category). */
  subcategoryId?: number | null;
};

export type TransactionsPageResult = {
  items: TransactionListItem[];
  totalCount: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type TransactionsSummary = {
  income: string;
  expense: string;
  net: string;
  count: number;
};

export type { CsvExportResult, TransactionsPdfExportResult } from "../export/types";

export type TransactionFilterOptions = {
  banks: string[];
  konten: string[];
};

export type TransactionNavArgs = {
  id: number;
  pageSize?: number;
  banks?: string[];
  konten?: string[];
  typ?: TransactionTyp;
  categorySource?: CategorySourceFilter;
  includeBalanceAdjustments?: boolean;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  categoryId?: number | null;
  subcategoryId?: number | null;
};

export type TransactionNavResult = {
  item: TransactionListItem;
  /** 1-based page under current filters, or null if filters exclude the row. */
  page: number | null;
};

/** Toggleable table columns (Details action is always shown). */
export type TxColumnKey =
  | "datum"
  | "bank"
  | "konto"
  | "sender"
  | "empfaenger"
  | "verwendungszweck"
  | "iban"
  | "kundenreferenz"
  | "kategorie"
  | "konfidenz"
  | "related"
  | "betrag";

export const TX_COLUMN_DEFS: {
  key: TxColumnKey;
  label: string;
  defaultVisible: boolean;
}[] = [
  { key: "datum", label: "Datum", defaultVisible: true },
  { key: "bank", label: "Bank", defaultVisible: true },
  { key: "konto", label: "Konto", defaultVisible: true },
  { key: "sender", label: "Sender", defaultVisible: true },
  { key: "empfaenger", label: "Empfänger", defaultVisible: true },
  { key: "verwendungszweck", label: "Verwendungszweck", defaultVisible: true },
  { key: "iban", label: "IBAN", defaultVisible: false },
  { key: "kundenreferenz", label: "Kundenreferenz", defaultVisible: false },
  { key: "kategorie", label: "Kategorie", defaultVisible: true },
  { key: "konfidenz", label: "Konfidenz", defaultVisible: true },
  { key: "related", label: "Verknüpfung", defaultVisible: true },
  { key: "betrag", label: "Betrag", defaultVisible: true },
];

export const TX_COLUMNS_STORAGE_KEY = "zm-tx-columns-v1";

export const PAGE_SIZE_OPTIONS = [50, 100, 250, 500] as const;
export const DEFAULT_PAGE_SIZE = 100;
