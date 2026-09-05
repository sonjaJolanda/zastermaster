import { HttpError } from "wasp/server";
import type { CategorizeTransaction } from "wasp/server/operations";
import { normalizeForMatch } from "./matchKeywords";
import { suggestKeywordsFromTransaction } from "./suggestKeywords";

export type CategorizeTransactionInput = {
  transactionId: number;
  categoryId: number;
  subcategoryId: number;
  /** Selected keyword suggestions to append to the chosen subcategory. */
  rememberKeywords?: string[];
};

export const categorizeTransaction: CategorizeTransaction<
  CategorizeTransactionInput,
  { id: number; syncedRelatedId: number | null; remembered: boolean }
> = async (args, context) => {
  if (!args?.transactionId || !args.categoryId || !args.subcategoryId) {
    throw new HttpError(
      400,
      "transactionId, categoryId und subcategoryId sind erforderlich.",
    );
  }

  const sub = await context.entities.Subcategory.findFirst({
    where: { id: args.subcategoryId, categoryId: args.categoryId },
    select: { id: true },
  });
  if (!sub) {
    throw new HttpError(
      400,
      "Unterkategorie gehört nicht zur gewählten Kategorie.",
    );
  }

  const existing = await context.entities.Transaction.findUnique({
    where: { id: args.transactionId },
    select: {
      id: true,
      relatedTransactionId: true,
      relatedGroupId: true,
      sender: true,
      empfaenger: true,
      verwendungszweck: true,
    },
  });
  if (!existing) {
    throw new HttpError(404, "Transaktion nicht gefunden.");
  }

  const categoryData = {
    categoryId: args.categoryId,
    subcategoryId: args.subcategoryId,
    categorySource: "manual" as const,
    confidenceScore: 1,
  };

  let ids: number[] = [existing.id];
  if (existing.relatedGroupId != null) {
    const members = await context.entities.Transaction.findMany({
      where: { relatedGroupId: existing.relatedGroupId },
      select: { id: true },
    });
    ids = members.map((m) => m.id);
  } else {
    let partnerId = existing.relatedTransactionId;
    if (partnerId == null) {
      const reverse = await context.entities.Transaction.findFirst({
        where: { relatedTransactionId: existing.id },
        select: { id: true },
      });
      partnerId = reverse?.id ?? null;
    }
    if (partnerId != null) ids = [existing.id, partnerId];
  }

  await context.entities.Transaction.updateMany({
    where: { id: { in: ids } },
    data: categoryData,
  });

  const syncedRelatedId =
    ids.find((id) => id !== existing.id) ?? null;

  let remembered = false;
  const requested = (args.rememberKeywords ?? [])
    .map((k) => k.trim().replace(/\s+/g, " "))
    .filter(Boolean);

  if (requested.length > 0) {
    const allowed = new Set(
      suggestKeywordsFromTransaction({
        sender: existing.sender,
        empfaenger: existing.empfaenger,
        verwendungszweck: existing.verwendungszweck,
      }).map((k) => normalizeForMatch(k)),
    );
    const toAdd: string[] = [];
    const seen = new Set<string>();
    for (const kw of requested) {
      const key = normalizeForMatch(kw);
      if (!key || seen.has(key) || !allowed.has(key)) continue;
      seen.add(key);
      toAdd.push(kw);
    }

    if (toAdd.length > 0) {
      const existingKws = await context.entities.CategoryKeyword.findMany({
        where: { subcategoryId: args.subcategoryId },
        select: { keyword: true },
      });
      const have = new Set(
        existingKws.map((k) => normalizeForMatch(k.keyword)),
      );
      const fresh = toAdd.filter((k) => !have.has(normalizeForMatch(k)));
      if (fresh.length > 0) {
        await context.entities.CategoryKeyword.createMany({
          data: fresh.map((keyword) => ({
            keyword,
            subcategoryId: args.subcategoryId,
          })),
        });
      }
      remembered = fresh.length > 0 || toAdd.length > 0;
    }
  }

  return { id: existing.id, syncedRelatedId, remembered };
};
