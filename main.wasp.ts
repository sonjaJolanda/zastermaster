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
  getCategories,
  seedCategoriesIfEmpty,
} from "./src/features/categories/operations" with { type: "ref" };
import { importBankFile } from "./src/features/import/operations" with {
  type: "ref",
};
import {
  getTransactionFilterOptions,
  getTransactions,
  getTransactionsSummary,
  getTransactionNav,
} from "./src/features/transactions/operations" with { type: "ref" };
import { categorizeTransaction } from "./src/features/categorization/operations" with {
  type: "ref",
};
import {
  getHeaderBalance,
  setAccountBalance,
} from "./src/features/accounts/operations" with { type: "ref" };
import { getAnalysisSummary } from "./src/features/analysis/operations" with {
  type: "ref",
};
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
      entities: ["Transaction", "Category", "Subcategory"],
    }),
    //#endregion

    //#region Accounts
    query(getHeaderBalance, { entities: ["Account"] }),
    action(setAccountBalance, { entities: ["Account"] }),
    //#endregion

    //#region Analysis
    query(getAnalysisSummary, { entities: ["Transaction"] }),
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
