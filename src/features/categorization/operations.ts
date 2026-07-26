import { HttpError } from "wasp/server";
import type { CategorizeTransaction } from "wasp/server/operations";

export type CategorizeTransactionInput = {
  transactionId: number;
  categoryId: number;
  subcategoryId: number;
};

export const categorizeTransaction: CategorizeTransaction<
  CategorizeTransactionInput,
  { id: number; syncedRelatedId: number | null }
> = async (args, context) => {
  if (!args?.transactionId || !args.categoryId || !args.subcategoryId) {
    throw new HttpError(400, "transactionId, categoryId und subcategoryId sind erforderlich.");
  }

  const sub = await context.entities.Subcategory.findFirst({
    where: { id: args.subcategoryId, categoryId: args.categoryId },
    select: { id: true },
  });
  if (!sub) {
    throw new HttpError(400, "Unterkategorie gehört nicht zur gewählten Kategorie.");
  }

  const existing = await context.entities.Transaction.findUnique({
    where: { id: args.transactionId },
    select: { id: true, relatedTransactionId: true },
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

  // Also pick up reverse link if only one direction were set.
  let partnerId = existing.relatedTransactionId;
  if (partnerId == null) {
    const reverse = await context.entities.Transaction.findFirst({
      where: { relatedTransactionId: existing.id },
      select: { id: true },
    });
    partnerId = reverse?.id ?? null;
  }

  const ids = partnerId != null ? [existing.id, partnerId] : [existing.id];
  await context.entities.Transaction.updateMany({
    where: { id: { in: ids } },
    data: categoryData,
  });

  return { id: existing.id, syncedRelatedId: partnerId };
};
