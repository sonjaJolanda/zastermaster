export type CsvExportResult = {
  csv: string;
  rowCount: number;
  fileName: string;
};

export type TransactionsPdfRow = {
  datum: string;
  bank: string;
  konto: string;
  betrag: string;
  verwendungszweck: string;
  kategorie: string;
};

export type TransactionsPdfExportResult = {
  rows: TransactionsPdfRow[];
  totalCount: number;
  truncated: boolean;
};
