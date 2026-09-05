import { app, page, route, query, action } from "@wasp.sh/spec";
import { App } from "./src/App" with { type: "ref" };
import { AnalysePage } from "./src/pages/AnalysePage" with { type: "ref" };
import { EinstellungenPage } from "./src/pages/EinstellungenPage" with {
  type: "ref",
};
import { TransaktionenPage } from "./src/pages/TransaktionenPage" with {
  type: "ref",
};
import { UploadPage } from "./src/pages/UploadPage" with { type: "ref" };
import { serverMiddlewareFn } from "./src/serverSetup" with { type: "ref" };
import {
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  getCategories,
  seedCategoriesIfEmpty,
  setKeywords,
  updateCategory,
  updateSubcategory,
} from "./src/features/categories/operations" with { type: "ref" };
import { importBankFile } from "./src/features/import/operations" with {
  type: "ref",
};
import {
  getTransactionFilterOptions,
  getTransactions,
  getTransactionsSummary,
  getTransactionNav,
  exportTransactionsCsv,
  exportTransactionsForPdf,
} from "./src/features/transactions/operations" with { type: "ref" };
import { categorizeTransaction } from "./src/features/categorization/operations" with {
  type: "ref",
};
import {
  getHeaderBalance,
  getAccounts,
  setAccountBalance,
} from "./src/features/accounts/operations" with { type: "ref" };
import {
  getAnalysisBreakdown,
  getAnalysisByCategory,
  getAnalysisSummary,
  getAnalysisTimeSeries,
  exportAnalysisCsv,
} from "./src/features/analysis/operations" with { type: "ref" };
import {
  confirmRelatedPair,
  detectRelatedTransactions,
  rejectRelatedPair,
  searchRelatedLinkCandidates,
  unlinkRelatedPair,
} from "./src/features/related/operations" with { type: "ref" };
import {
  clearInvestment,
  confirmInvestment,
  detectInvestments,
  getInvestedTotal,
  getInvestmentKeywords,
  rejectInvestment,
  setInvestmentKeywords,
} from "./src/features/investments/operations" with { type: "ref" };
import { getBackgroundOptions } from "./src/features/backgrounds/operations" with {
  type: "ref",
};

export default app({
  name: "ZasterMaster",
  title: "Zaster Master",
  wasp: { version: "^0.24.0" },
  head: [
    "<link rel='icon' href='/favicon.svg' type='image/svg+xml' />",
    "<link rel='preconnect' href='https://fonts.googleapis.com' />",
    "<link rel='preconnect' href='https://fonts.gstatic.com' />",
    "<link href='https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap' rel='stylesheet' />",
  ],
  client: {
    rootComponent: App,
  },
  server: {
    middlewareConfigFn: serverMiddlewareFn,
  },
  spec: [
    //#region Pages
    route("TransaktionenRoute", "/", page(TransaktionenPage)),
    route("UploadRoute", "/upload", page(UploadPage)),
    route("EinstellungenRoute", "/einstellungen", page(EinstellungenPage)),
    route("AnalyseRoute", "/analyse", page(AnalysePage)),
    //#endregion

    //#region Categories
    query(getCategories, {
      entities: ["Category", "Subcategory", "CategoryKeyword"],
    }),
    action(seedCategoriesIfEmpty, {
      entities: ["Category", "Subcategory", "CategoryKeyword"],
    }),
    action(createCategory, {
      entities: ["Category", "Subcategory"],
    }),
    action(updateCategory, { entities: ["Category"] }),
    action(deleteCategory, {
      entities: ["Category", "Subcategory", "Transaction"],
    }),
    action(createSubcategory, { entities: ["Category", "Subcategory"] }),
    action(updateSubcategory, { entities: ["Subcategory"] }),
    action(deleteSubcategory, {
      entities: ["Subcategory", "Transaction"],
    }),
    action(setKeywords, {
      entities: ["Category", "Subcategory", "CategoryKeyword"],
    }),
    //#endregion

    //#region Import / Transactions
    query(getTransactions, {
      entities: ["Transaction", "Category", "Subcategory"],
    }),
    query(getTransactionsSummary, { entities: ["Transaction"] }),
    query(getTransactionFilterOptions, { entities: ["Transaction"] }),
    query(getTransactionNav, {
      entities: ["Transaction", "Category", "Subcategory"],
    }),
    query(exportTransactionsCsv, {
      entities: ["Transaction", "Category", "Subcategory"],
    }),
    query(exportTransactionsForPdf, {
      entities: ["Transaction", "Category", "Subcategory"],
    }),
    action(importBankFile, {
      entities: [
        "Transaction",
        "Category",
        "Subcategory",
        "CategoryKeyword",
        "Account",
      ],
    }),
    //#endregion

    //#region Categorization
    action(categorizeTransaction, {
      entities: [
        "Transaction",
        "Category",
        "Subcategory",
        "CategoryKeyword",
      ],
    }),
    //#endregion

    //#region Accounts
    query(getHeaderBalance, { entities: ["Account", "Transaction"] }),
    query(getAccounts, { entities: ["Account", "Transaction"] }),
    action(setAccountBalance, { entities: ["Account", "Transaction"] }),
    //#endregion

    //#region Backgrounds
    query(getBackgroundOptions, { entities: [] }),
    //#endregion

    //#region Analysis
    query(getAnalysisSummary, {
      entities: ["Transaction", "Category", "Subcategory"],
    }),
    query(getAnalysisTimeSeries, {
      entities: ["Transaction", "Category", "Subcategory"],
    }),
    query(getAnalysisByCategory, {
      entities: ["Transaction", "Category", "Subcategory"],
    }),
    query(getAnalysisBreakdown, {
      entities: ["Transaction", "Category", "Subcategory"],
    }),
    query(exportAnalysisCsv, {
      entities: ["Transaction", "Category", "Subcategory"],
    }),
    //#endregion

    //#region Related
    action(detectRelatedTransactions, {
      entities: ["Transaction", "RelatedRejection"],
    }),
    query(searchRelatedLinkCandidates, { entities: ["Transaction"] }),
    action(confirmRelatedPair, {
      entities: ["Transaction", "RelatedRejection"],
    }),
    action(rejectRelatedPair, { entities: ["RelatedRejection"] }),
    action(unlinkRelatedPair, {
      entities: ["Transaction", "RelatedRejection"],
    }),
    //#endregion

    //#region Investments
    query(getInvestmentKeywords, { entities: ["InvestmentKeyword"] }),
    query(getInvestedTotal, { entities: ["Transaction"] }),
    action(setInvestmentKeywords, { entities: ["InvestmentKeyword"] }),
    action(detectInvestments, {
      entities: ["Transaction", "InvestmentKeyword", "InvestmentRejection"],
    }),
    action(confirmInvestment, {
      entities: ["Transaction", "InvestmentRejection"],
    }),
    action(rejectInvestment, { entities: ["InvestmentRejection"] }),
    action(clearInvestment, {
      entities: ["Transaction", "InvestmentRejection"],
    }),
    //#endregion
  ],
});
