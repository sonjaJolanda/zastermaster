import type { CategoryKeyword } from "wasp/entities";
import type {
  GetCategories,
  SeedCategoriesIfEmpty,
} from "wasp/server/operations";
import { loadCategoriesSeed } from "./seedData";
import type { CategoryTreeNode } from "./types";

export type { CategoryTreeNode };

/** Read-only category tree for Einstellungen (and later pickers). */
export const getCategories: GetCategories<void, CategoryTreeNode[]> = async (
  _args,
  context,
) => {
  const categories = await context.entities.Category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      keywords: { orderBy: { id: "asc" } },
      subcategories: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: {
          keywords: { orderBy: { id: "asc" } },
        },
      },
    },
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    sortOrder: category.sortOrder,
    keywords: category.keywords.map((k: CategoryKeyword) => k.keyword),
    subcategories: category.subcategories.map((sub) => ({
      id: sub.id,
      name: sub.name,
      color: sub.color,
      sortOrder: sub.sortOrder,
      keywords: sub.keywords.map((k: CategoryKeyword) => k.keyword),
    })),
  }));
};

export const seedCategoriesIfEmpty: SeedCategoriesIfEmpty<
  void,
  { seeded: boolean; categoryCount: number }
> = async (_args, context) => {
  const existing = await context.entities.Category.count();
  if (existing > 0) {
    return { seeded: false, categoryCount: existing };
  }

  const seed = loadCategoriesSeed();
  const categoryNames = Object.keys(seed);

  for (let catIndex = 0; catIndex < categoryNames.length; catIndex++) {
    const name = categoryNames[catIndex]!;
    const catSeed = seed[name]!;

    const category = await context.entities.Category.create({
      data: {
        name,
        color: catSeed.color,
        sortOrder: catIndex,
        keywords: {
          create: (catSeed.keywords ?? []).map((keyword) => ({ keyword })),
        },
      },
    });

    const subNames = Object.keys(catSeed.subcategories ?? {});
    for (let subIndex = 0; subIndex < subNames.length; subIndex++) {
      const subName = subNames[subIndex]!;
      const subSeed = catSeed.subcategories[subName]!;

      await context.entities.Subcategory.create({
        data: {
          name: subName,
          color: subSeed.color,
          sortOrder: subIndex,
          categoryId: category.id,
          keywords: {
            create: (subSeed.keywords ?? []).map((keyword) => ({ keyword })),
          },
        },
      });
    }
  }

  const categoryCount = await context.entities.Category.count();
  return { seeded: true, categoryCount };
};
