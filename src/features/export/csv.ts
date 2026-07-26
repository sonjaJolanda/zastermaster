/** Semicolon CSV helpers for German Excel (UTF-8 BOM). */

export function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[;"\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toSemicolonCsv(
  headers: string[],
  rows: (string | number | null | undefined)[][],
): string {
  const lines = [
    headers.map(csvEscape).join(";"),
    ...rows.map((r) => r.map(csvEscape).join(";")),
  ];
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
