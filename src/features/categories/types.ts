export type CategoryKeywordItem = {
  id: number;
  keyword: string;
};

export type CategoryTreeNode = {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
  keywords: CategoryKeywordItem[];
  subcategories: {
    id: number;
    name: string;
    color: string;
    sortOrder: number;
    keywords: CategoryKeywordItem[];
  }[];
};

export type UpsertCategoryArgs = {
  id?: number;
  name: string;
  color: string;
};

export type UpsertSubcategoryArgs = {
  id?: number;
  categoryId?: number;
  name: string;
  color: string;
};

export type DeleteByIdArgs = {
  id: number;
  /**
   * When txs still reference this category/subcategory, move them here first
   * (any subcategory in the tree is allowed).
   */
  reassignToSubcategoryId?: number;
};

export type DeleteCategoryResult =
  | { ok: true; reassigned: number }
  | { ok: false; needsReassign: true; txCount: number; name: string };

export type SetKeywordsArgs = {
  /** Exactly one of categoryId / subcategoryId. */
  categoryId?: number;
  subcategoryId?: number;
  keywords: string[];
};
