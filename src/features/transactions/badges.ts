/** CSS class helpers for bank / konto badges (Slice 10 design). */

import { defaultAccountColor } from "../accounts/colors";

/** Base class; color comes from Account.color (or bank default) via inline style. */
export function bankBadgeClass(): string {
  return "zm-bank-badge";
}

export function bankBadgeColor(
  bank: string,
  storedOrResolved?: string | null,
): string {
  const c = (storedOrResolved ?? "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
  return defaultAccountColor(bank);
}

export function bankLabel(bank: string): string {
  const b = bank.trim().toLowerCase();
  if (b === "traderepublic") return "Trade Republic";
  if (b === "paypal") return "PayPal";
  return bank.toUpperCase();
}

export function kontoPillClass(konto: string): string {
  const k = konto.trim().toLowerCase();
  if (k.includes("giro")) return "zm-konto-pill zm-konto-giro";
  if (k.includes("tagesgeld")) return "zm-konto-pill zm-konto-tagesgeld";
  if (k.includes("paypal")) return "zm-konto-pill zm-konto-paypal";
  if (k.includes("sparkasse")) return "zm-konto-pill zm-konto-sparkasse";
  if (k.includes("trade")) return "zm-konto-pill zm-konto-sonstige";
  if (!k) return "zm-konto-pill zm-konto-unknown";
  return "zm-konto-pill zm-konto-sonstige";
}
