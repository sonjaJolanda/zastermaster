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
};

export type SetKeywordsArgs = {
  /** Exactly one of categoryId / subcategoryId. */
  categoryId?: number;
  subcategoryId?: number;
  keywords: string[];
};
