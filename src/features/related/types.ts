export type RelatedType = "paypal_bank" | "transfer" | "near_duplicate";

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
  pairKey: string;
  type: RelatedType;
  score: number;
  reason: string;
  a: RelatedTxPublic;
  b: RelatedTxPublic;
};

export type DetectRelatedResult = {
  suggestions: RelatedSuggestion[];
  truncated: boolean;
};

export type ConfirmRelatedArgs = {
  aId: number;
  bId: number;
  type: RelatedType;
};

export type RejectRelatedArgs = {
  aId: number;
  bId: number;
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
