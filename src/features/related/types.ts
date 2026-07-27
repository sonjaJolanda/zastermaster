export type RelatedType =
  | "paypal_bank"
  | "paypal_purchase"
  | "transfer"
  | "near_duplicate";

export type RelatedTxPublic = {
  id: number;
  datum: string;
  betrag: string;
  sender: string;
  empfaenger: string;
  verwendungszweck: string;
  bank: string;
  konto: string;
};

export type RelatedSuggestion = {
  /** Sorted member ids joined by `:`. */
  groupKey: string;
  type: RelatedType;
  score: number;
  reason: string;
  /** 2 or 3 legs. */
  members: RelatedTxPublic[];
};

export type DetectRelatedResult = {
  suggestions: RelatedSuggestion[];
  truncated: boolean;
};

export type ConfirmRelatedArgs = {
  /** Exactly 2 or 3 transaction ids. */
  ids: number[];
  type: RelatedType;
};

export type RejectRelatedArgs = {
  /** Exactly 2 or 3 transaction ids. */
  ids: number[];
};

export type UnlinkRelatedArgs = {
  transactionId: number;
};

export type SearchRelatedLinkArgs = {
  /** Ids already chosen (current tx + selected partners) — excluded from results. */
  excludeIds: number[];
  /** Anchor date (YYYY-MM-DD) of the tx being linked — candidates limited to ±10 days. */
  aroundDate: string;
  /** Free text: id, zweck, sender, empfaenger, bank, konto */
  search?: string;
  limit?: number;
};

/** Candidate row for pure detectors (in-memory). */
export type DetectCandidate = {
  id: number;
  datum: Date;
  betrag: number;
  sender: string;
  empfaenger: string;
  verwendungszweck: string;
  bank: string;
  konto: string;
};
