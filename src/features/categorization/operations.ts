import { HttpError } from "wasp/server";
import type { CategorizeTransaction } from "wasp/server/operations";
import { fragmentFromTransaction } from "./matchLearnedRules";

export type CategorizeTransactionInput = {
  transactionId: number;
  categoryId: number;
  subcategoryId: number;
  /** Persist a LearnedRule from Verwendungszweck (else sender/empfaenger). */
  remember?: boolean;
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

  let remembered = false;
  if (args.remember) {
    const fragment = fragmentFromTransaction({
      sender: existing.sender,
      empfaenger: existing.empfaenger,
      verwendungszweck: existing.verwendungszweck,
    });
    if (!fragment) {
      throw new HttpError(
        400,
        "Zum Merken braucht die Buchung Verwendungszweck, Sender oder Empfänger.",
      );
    }
    await context.entities.LearnedRule.upsert({
      where: { descriptionFragment: fragment },
      create: {
        descriptionFragment: fragment,
        categoryId: args.categoryId,
        subcategoryId: args.subcategoryId,
        confidence: 1,
        usageCount: 0,
      },
      update: {
        categoryId: args.categoryId,
        subcategoryId: args.subcategoryId,
        confidence: 1,
      },
    });
    remembered = true;
  }

  return { id: existing.id, syncedRelatedId: partnerId, remembered };
};
