export type CategoryTreeNode = {
  id: number;
  name: string;
  color: string;
  sortOrder: number;
  keywords: string[];
  subcategories: {
    id: number;
    name: string;
    color: string;
    sortOrder: number;
    keywords: string[];
  }[];
};
