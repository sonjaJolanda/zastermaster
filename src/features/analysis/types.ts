export type AnalysisTyp = "all" | "income" | "expense";

export type AnalysisFilterArgs = {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;
  banks?: string[];
  konten?: string[];
  typ?: AnalysisTyp;
};

export type AnalysisSummary = {
  income: string;
  expense: string;
  net: string;
  count: number;
  dateFrom: string;
  dateTo: string;
};
