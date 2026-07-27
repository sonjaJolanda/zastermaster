import type { RelatedType } from "./types";

type Leg = {
  bank: string;
  konto: string;
  betrag: number;
};

function isPaypal(bank: string): boolean {
  return bank.toLowerCase() === "paypal";
}

/** True when legs look like PayPal Kauf (−) + Funding (+) + Bank (−). */
export function matchesPaypalPurchase(legs: Leg[]): boolean {
  if (legs.length !== 3) return false;
  const paypalNeg = legs.filter((l) => isPaypal(l.bank) && l.betrag < 0);
  const paypalPos = legs.filter((l) => isPaypal(l.bank) && l.betrag > 0);
  const bankNeg = legs.filter((l) => !isPaypal(l.bank) && l.betrag < 0);
  return (
    paypalNeg.length === 1 &&
    paypalPos.length === 1 &&
    bankNeg.length === 1
  );
}

/** Heuristic type for manual linking (user can override). */
export function suggestRelatedType(a: Leg, b: Leg): RelatedType {
  return suggestRelatedTypeForGroup([a, b]);
}

export function suggestRelatedTypeForGroup(legs: Leg[]): RelatedType {
  if (matchesPaypalPurchase(legs)) return "paypal_purchase";

  if (legs.length !== 2) return "near_duplicate";
  const [a, b] = legs as [Leg, Leg];

  const aPay = isPaypal(a.bank);
  const bPay = isPaypal(b.bank);
  if (aPay !== bPay) return "paypal_bank";

  const opposite =
    (a.betrag > 0 && b.betrag < 0) || (a.betrag < 0 && b.betrag > 0);
  const differentAccount =
    a.bank !== b.bank || a.konto !== b.konto;
  if (opposite && differentAccount) return "transfer";

  return "near_duplicate";
}
