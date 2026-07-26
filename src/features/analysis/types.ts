export type AnalysisTyp = "all" | "income" | "expense";

export type AnalysisGrouping = "day" | "month" | "year";

export type AnalysisFilterArgs = {
  dateFrom: string; // YYYY-MM-DD
  dateTo: string;
  banks?: string[];
  konten?: string[];
  typ?: AnalysisTyp;
  categoryId?: number | null;
  subcategoryId?: number | null;
  /** Override auto grouping for the time series. */
  grouping?: AnalysisGrouping;
};

export type AnalysisSummary = {
  income: string;
  expense: string;
  net: string;
  count: number;
  dateFrom: string;
  dateTo: string;
};

export type AnalysisTimeSeriesPoint = {
  period: string;
  label: string;
  income: string;
  expense: string;
};

export type AnalysisTimeSeries = {
  grouping: AnalysisGrouping;
  points: AnalysisTimeSeriesPoint[];
};

export type AnalysisCategorySlice = {
  /** categoryId or subcategoryId depending on mode; null = Sonstige. */
  id: number | null;
  name: string;
  color: string;
  amount: string;
  percent: number;
  count: number;
};

export type AnalysisByCategory = {
  /** When a main category is selected, slices are subcategories. */
  mode: "category" | "subcategory";
  expenses: AnalysisCategorySlice[];
  income: AnalysisCategorySlice[];
};

export type AnalysisBreakdownChild = {
  id: number | null;
  name: string;
  color: string;
  amount: string;
  percent: number;
  count: number;
};

export type AnalysisBreakdownRow = {
  id: number | null;
  name: string;
  color: string;
  amount: string;
  percent: number;
  count: number;
  children: AnalysisBreakdownChild[];
};

export type AnalysisBreakdown = {
  mode: "category" | "subcategory";
  expenses: AnalysisBreakdownRow[];
  income: AnalysisBreakdownRow[];
};
