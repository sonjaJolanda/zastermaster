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
} from "./src/features/related/operations" with { type: "ref" };

export default app({
  name: "ZasterMaster",
  title: "Zaster Master",
  wasp: { version: "^0.24.0" },
  head: [
    "<link rel='icon' href='/favicon.ico' />",
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
      entities: ["Category", "Transaction"],
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
    action(importBankFile, {
      entities: [
        "Transaction",
        "Category",
        "Subcategory",
        "CategoryKeyword",
        "Account",
        "LearnedRule",
      ],
    }),
    //#endregion

    //#region Categorization
    action(categorizeTransaction, {
      entities: ["Transaction", "Category", "Subcategory", "LearnedRule"],
    }),
    //#endregion

    //#region Accounts
    query(getHeaderBalance, { entities: ["Account", "Transaction"] }),
    query(getAccounts, { entities: ["Account", "Transaction"] }),
    action(setAccountBalance, { entities: ["Account", "Transaction"] }),
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
    action(confirmRelatedPair, { entities: ["Transaction"] }),
    action(rejectRelatedPair, { entities: ["RelatedRejection"] }),
    //#endregion
  ],
});
