export type CategorySource = "manual" | "learned" | "keyword" | "none";

export type TransactionTyp = "all" | "income" | "expense";

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
  confidenceScore: number;
  categorySource: CategorySource;
  relatedTransactionId: number | null;
  relatedType: "paypal_bank" | "transfer" | "near_duplicate" | null;
};

export type TransactionFilterArgs = {
  page?: number;
  pageSize?: number;
  banks?: string[];
  konten?: string[];
  typ?: TransactionTyp;
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
  count: number;
};

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
};

export type TransactionNavResult = {
  item: TransactionListItem;
  /** 1-based page under current filters, or null if filters exclude the row. */
  page: number | null;
};

export const PAGE_SIZE_OPTIONS = [50, 100, 250, 500] as const;
export const DEFAULT_PAGE_SIZE = 100;
