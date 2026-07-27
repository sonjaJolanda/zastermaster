/** Semicolon CSV helpers for German Excel (UTF-8 BOM). */

export function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[;"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Build a semicolon CSV. Pass `headers: null` to omit the header line.
 * An empty row `[]` inserts a blank line between sections.
 */
export function toSemicolonCsv(
  headers: string[] | null,
  rows: (string | number | null | undefined)[][],
): string {
  const lines: string[] = [];
  if (headers) {
    lines.push(headers.map(csvEscape).join(";"));
  }
  for (const r of rows) {
    if (r.length === 0) {
      lines.push("");
    } else {
      lines.push(r.map(csvEscape).join(";"));
    }
  }
  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
