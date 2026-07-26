/** Default account/bank badge colors (design.md bank badges). */

export function defaultAccountColor(bank: string): string {
  switch (bank.trim().toLowerCase()) {
    case "dkb":
      return "#428eec";
    case "paypal":
      return "#00457c";
    case "sparkasse":
      return "#dc2626";
    case "traderepublic":
      return "#6b21a8";
    default:
      return "#1f2937";
  }
}

export function normalizeAccountColor(raw: string | null | undefined): string | null {
  const c = (raw ?? "").trim();
  if (!c) return null;
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(c)) {
    const r = c[1]!;
    const g = c[2]!;
    const b = c[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return null;
}

/** Resolved color: stored value or bank default. */
export function resolveAccountColor(
  bank: string,
  stored: string | null | undefined,
): string {
  return normalizeAccountColor(stored) ?? defaultAccountColor(bank);
}
