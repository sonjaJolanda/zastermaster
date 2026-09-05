import { HttpError } from "wasp/server";
import type { CategoryKeyword } from "wasp/entities";
import type {
  CreateCategory,
  CreateSubcategory,
  DeleteCategory,
  DeleteSubcategory,
  GetCategories,
  SeedCategoriesIfEmpty,
  SetKeywords,
  UpdateCategory,
  UpdateSubcategory,
} from "wasp/server/operations";
import { loadCategoriesSeed } from "./seedData";
import type {
  CategoryTreeNode,
  DeleteByIdArgs,
  DeleteCategoryResult,
  SetKeywordsArgs,
  UpsertCategoryArgs,
  UpsertSubcategoryArgs,
} from "./types";

export type {
  CategoryTreeNode,
  DeleteByIdArgs,
  DeleteCategoryResult,
  SetKeywordsArgs,
  UpsertCategoryArgs,
  UpsertSubcategoryArgs,
} from "./types";

function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function normalizeColor(raw: string): string {
  const c = raw.trim();
  if (!/^#[0-9A-Fa-f]{6}$/.test(c)) {
    throw new HttpError(400, "Farbe muss als #RRGGBB angegeben werden.");
  }
  return c.toLowerCase();
}

function normalizeKeywords(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const kw = item.trim().replace(/\s+/g, " ");
    if (!kw) continue;
    const key = kw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(kw);
  }
  return out;
}

/** Read category tree for Einstellungen and pickers. */
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
    keywords: category.keywords.map((k: CategoryKeyword) => ({
      id: k.id,
      keyword: k.keyword,
    })),
    subcategories: category.subcategories.map((sub) => ({
      id: sub.id,
      name: sub.name,
      color: sub.color,
      sortOrder: sub.sortOrder,
      keywords: sub.keywords.map((k: CategoryKeyword) => ({
        id: k.id,
        keyword: k.keyword,
      })),
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

export const createCategory: CreateCategory<
  UpsertCategoryArgs,
  { id: number }
> = async (args, context) => {
  const name = normalizeName(args?.name ?? "");
  const color = normalizeColor(args?.color ?? "");
  if (!name) throw new HttpError(400, "Name ist erforderlich.");

  const maxSort = await context.entities.Category.aggregate({
    _max: { sortOrder: true },
  });

  try {
    const category = await context.entities.Category.create({
      data: {
        name,
        color,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
        subcategories: {
          create: {
            name: "Unbekannt",
            color,
            sortOrder: 0,
          },
        },
      },
      select: { id: true },
    });
    return category;
  } catch {
    throw new HttpError(409, `Kategorie „${name}“ existiert bereits.`);
  }
};

export const updateCategory: UpdateCategory<
  UpsertCategoryArgs,
  { id: number }
> = async (args, context) => {
  if (!args?.id) throw new HttpError(400, "id ist erforderlich.");
  const name = normalizeName(args.name ?? "");
  const color = normalizeColor(args.color ?? "");
  if (!name) throw new HttpError(400, "Name ist erforderlich.");

  const existing = await context.entities.Category.findUnique({
    where: { id: args.id },
    select: { id: true },
  });
  if (!existing) throw new HttpError(404, "Kategorie nicht gefunden.");

  try {
    const updated = await context.entities.Category.update({
      where: { id: args.id },
      data: { name, color },
      select: { id: true },
    });
    return updated;
  } catch {
    throw new HttpError(409, `Kategorie „${name}“ existiert bereits.`);
  }
};

export const deleteCategory: DeleteCategory<
  DeleteByIdArgs,
  DeleteCategoryResult
> = async (args, context) => {
  if (!args?.id) throw new HttpError(400, "id ist erforderlich.");

  const existing = await context.entities.Category.findUnique({
    where: { id: args.id },
    select: {
      id: true,
      name: true,
      subcategories: { select: { id: true } },
    },
  });
  if (!existing) throw new HttpError(404, "Kategorie nicht gefunden.");

  const subIds = existing.subcategories.map((s) => s.id);
  const txCount = await context.entities.Transaction.count({
    where: {
      OR: [
        { categoryId: args.id },
        ...(subIds.length > 0 ? [{ subcategoryId: { in: subIds } }] : []),
      ],
    },
  });

  if (txCount > 0 && args.reassignToSubcategoryId == null) {
    return {
      ok: false,
      needsReassign: true,
      txCount,
      name: existing.name,
    };
  }

  if (txCount > 0 && args.reassignToSubcategoryId != null) {
    const target = await context.entities.Subcategory.findUnique({
      where: { id: args.reassignToSubcategoryId },
      select: { id: true, categoryId: true },
    });
    if (!target) {
      throw new HttpError(404, "Ziel-Unterkategorie nicht gefunden.");
    }
    if (target.categoryId === args.id) {
      throw new HttpError(
        400,
        "Ziel-Unterkategorie muss außerhalb der zu löschenden Kategorie liegen.",
      );
    }

    await context.entities.Transaction.updateMany({
      where: {
        OR: [
          { categoryId: args.id },
          ...(subIds.length > 0 ? [{ subcategoryId: { in: subIds } }] : []),
        ],
      },
      data: {
        categoryId: target.categoryId,
        subcategoryId: target.id,
        categorySource: "manual",
        confidenceScore: 1,
      },
    });

  }

  await context.entities.Category.delete({ where: { id: args.id } });
  return { ok: true, reassigned: txCount };
};

export const createSubcategory: CreateSubcategory<
  UpsertSubcategoryArgs,
  { id: number }
> = async (args, context) => {
  if (!args?.categoryId) throw new HttpError(400, "categoryId ist erforderlich.");
  const name = normalizeName(args.name ?? "");
  const color = normalizeColor(args.color ?? "");
  if (!name) throw new HttpError(400, "Name ist erforderlich.");

  const parent = await context.entities.Category.findUnique({
    where: { id: args.categoryId },
    select: { id: true },
  });
  if (!parent) throw new HttpError(404, "Kategorie nicht gefunden.");

  const maxSort = await context.entities.Subcategory.aggregate({
    where: { categoryId: args.categoryId },
    _max: { sortOrder: true },
  });

  try {
    const sub = await context.entities.Subcategory.create({
      data: {
        categoryId: args.categoryId,
        name,
        color,
        sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      },
      select: { id: true },
    });
    return sub;
  } catch {
    throw new HttpError(409, `Unterkategorie „${name}“ existiert bereits.`);
  }
};

export const updateSubcategory: UpdateSubcategory<
  UpsertSubcategoryArgs,
  { id: number }
> = async (args, context) => {
  if (!args?.id) throw new HttpError(400, "id ist erforderlich.");
  const name = normalizeName(args.name ?? "");
  const color = normalizeColor(args.color ?? "");
  if (!name) throw new HttpError(400, "Name ist erforderlich.");

  const existing = await context.entities.Subcategory.findUnique({
    where: { id: args.id },
    select: { id: true, categoryId: true },
  });
  if (!existing) throw new HttpError(404, "Unterkategorie nicht gefunden.");

  try {
    const updated = await context.entities.Subcategory.update({
      where: { id: args.id },
      data: { name, color },
      select: { id: true },
    });
    return updated;
  } catch {
    throw new HttpError(409, `Unterkategorie „${name}“ existiert bereits.`);
  }
};

export const deleteSubcategory: DeleteSubcategory<
  DeleteByIdArgs,
  DeleteCategoryResult
> = async (args, context) => {
  if (!args?.id) throw new HttpError(400, "id ist erforderlich.");

  const existing = await context.entities.Subcategory.findUnique({
    where: { id: args.id },
    select: { id: true, name: true, categoryId: true },
  });
  if (!existing) throw new HttpError(404, "Unterkategorie nicht gefunden.");

  const siblingCount = await context.entities.Subcategory.count({
    where: { categoryId: existing.categoryId },
  });
  if (siblingCount <= 1) {
    throw new HttpError(
      409,
      "Die letzte Unterkategorie einer Kategorie kann nicht gelöscht werden. Lösche ggf. die ganze Kategorie.",
    );
  }

  const txCount = await context.entities.Transaction.count({
    where: { subcategoryId: args.id },
  });

  if (txCount > 0 && args.reassignToSubcategoryId == null) {
    return {
      ok: false,
      needsReassign: true,
      txCount,
      name: existing.name,
    };
  }

  if (txCount > 0 && args.reassignToSubcategoryId != null) {
    if (args.reassignToSubcategoryId === args.id) {
      throw new HttpError(400, "Ziel darf nicht die zu löschende Unterkategorie sein.");
    }
    const target = await context.entities.Subcategory.findUnique({
      where: { id: args.reassignToSubcategoryId },
      select: { id: true, categoryId: true },
    });
    if (!target) {
      throw new HttpError(404, "Ziel-Unterkategorie nicht gefunden.");
    }

    await context.entities.Transaction.updateMany({
      where: { subcategoryId: args.id },
      data: {
        categoryId: target.categoryId,
        subcategoryId: target.id,
        categorySource: "manual",
        confidenceScore: 1,
      },
    });

  }

  await context.entities.Subcategory.delete({ where: { id: args.id } });
  return { ok: true, reassigned: txCount };
};

/** Replace keyword list for a category or subcategory. */
export const setKeywords: SetKeywords<
  SetKeywordsArgs,
  { ok: true; count: number }
> = async (args, context) => {
  const hasCat = args?.categoryId != null;
  const hasSub = args?.subcategoryId != null;
  if (hasCat === hasSub) {
    throw new HttpError(
      400,
      "Genau eines von categoryId oder subcategoryId angeben.",
    );
  }

  const keywords = normalizeKeywords(args.keywords ?? []);

  if (hasCat) {
    const cat = await context.entities.Category.findUnique({
      where: { id: args.categoryId },
      select: { id: true },
    });
    if (!cat) throw new HttpError(404, "Kategorie nicht gefunden.");

    await context.entities.CategoryKeyword.deleteMany({
      where: { categoryId: args.categoryId },
    });
    if (keywords.length > 0) {
      await context.entities.CategoryKeyword.createMany({
        data: keywords.map((keyword) => ({
          keyword,
          categoryId: args.categoryId,
        })),
      });
    }
    return { ok: true, count: keywords.length };
  }

  const sub = await context.entities.Subcategory.findUnique({
    where: { id: args.subcategoryId },
    select: { id: true },
  });
  if (!sub) throw new HttpError(404, "Unterkategorie nicht gefunden.");

  await context.entities.CategoryKeyword.deleteMany({
    where: { subcategoryId: args.subcategoryId },
  });
  if (keywords.length > 0) {
    await context.entities.CategoryKeyword.createMany({
      data: keywords.map((keyword) => ({
        keyword,
        subcategoryId: args.subcategoryId,
      })),
    });
  }
  return { ok: true, count: keywords.length };
};
