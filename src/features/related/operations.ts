import { HttpError } from "wasp/server";
import type {
  ConfirmRelatedPair,
  DetectRelatedTransactions,
  RejectRelatedPair,
} from "wasp/server/operations";
import { runDetectPipeline } from "./detect";
import type {
  ConfirmRelatedArgs,
  DetectCandidate,
  DetectRelatedResult,
  RejectRelatedArgs,
  RelatedType,
} from "./types";

export type {
  ConfirmRelatedArgs,
  DetectRelatedResult,
  RejectRelatedArgs,
  RelatedSuggestion,
  RelatedType,
  RelatedTxPublic,
} from "./types";

function pairIds(aId: number, bId: number): { low: number; high: number } {
  return aId < bId ? { low: aId, high: bId } : { low: bId, high: aId };
}

const RELATED_TYPES: RelatedType[] = [
  "paypal_bank",
  "transfer",
  "near_duplicate",
];

function parseRelatedType(raw: string): RelatedType {
  if ((RELATED_TYPES as string[]).includes(raw)) {
    return raw as RelatedType;
  }
  throw new HttpError(400, `Ungültiger Verknüpfungstyp: ${raw}`);
}

export const detectRelatedTransactions: DetectRelatedTransactions<
  void,
  DetectRelatedResult
> = async (_args, context) => {
  const [rows, rejects] = await Promise.all([
    context.entities.Transaction.findMany({
      where: { relatedTransactionId: null },
      select: {
        id: true,
        datum: true,
        betrag: true,
        sender: true,
        empfaenger: true,
        verwendungszweck: true,
        bank: true,
        konto: true,
      },
      orderBy: [{ datum: "asc" }, { id: "asc" }],
    }),
    context.entities.RelatedRejection.findMany({
      select: { txIdLow: true, txIdHigh: true },
    }),
  ]);

  const candidates: DetectCandidate[] = rows.map((r) => ({
    id: r.id,
    datum: r.datum,
    betrag: Number(r.betrag.toString()),
    sender: r.sender,
    empfaenger: r.empfaenger,
    verwendungszweck: r.verwendungszweck,
    bank: r.bank,
    konto: r.konto,
  }));

  const rejectedKeys = new Set(
    rejects.map((r) => `${r.txIdLow}:${r.txIdHigh}`),
  );

  return runDetectPipeline(candidates, rejectedKeys);
};

export const confirmRelatedPair: ConfirmRelatedPair<
  ConfirmRelatedArgs,
  { ok: true }
> = async (args, context) => {
  if (!args?.aId || !args?.bId || !args?.type) {
    throw new HttpError(400, "aId, bId und type sind erforderlich.");
  }
  if (args.aId === args.bId) {
    throw new HttpError(400, "Eine Transaktion kann nicht mit sich selbst verknüpft werden.");
  }

  const type = parseRelatedType(args.type);
  const [a, b] = await Promise.all([
    context.entities.Transaction.findUnique({ where: { id: args.aId } }),
    context.entities.Transaction.findUnique({ where: { id: args.bId } }),
  ]);

  if (!a || !b) {
    throw new HttpError(404, "Transaktion nicht gefunden.");
  }
  if (
    (a.relatedTransactionId != null && a.relatedTransactionId !== b.id) ||
    (b.relatedTransactionId != null && b.relatedTransactionId !== a.id)
  ) {
    throw new HttpError(409, "Eine der Transaktionen ist bereits verknüpft.");
  }

  await context.entities.Transaction.update({
    where: { id: a.id },
    data: { relatedTransactionId: b.id, relatedType: type },
  });
  await context.entities.Transaction.update({
    where: { id: b.id },
    data: { relatedTransactionId: a.id, relatedType: type },
  });

  // Linked pairs share one category: prefer the stronger source, else A.
  const sourceRank: Record<string, number> = {
    manual: 4,
    learned: 3,
    keyword: 2,
    none: 1,
  };
  const aRank = sourceRank[a.categorySource] ?? 0;
  const bRank = sourceRank[b.categorySource] ?? 0;
  const preferA =
    a.categoryId != null &&
    a.subcategoryId != null &&
    (b.categoryId == null ||
      b.subcategoryId == null ||
      aRank > bRank ||
      (aRank === bRank && a.id < b.id));
  const preferB =
    b.categoryId != null &&
    b.subcategoryId != null &&
    !preferA;

  if (preferA) {
    await context.entities.Transaction.update({
      where: { id: b.id },
      data: {
        categoryId: a.categoryId,
        subcategoryId: a.subcategoryId,
        categorySource: a.categorySource,
        confidenceScore: a.confidenceScore,
      },
    });
  } else if (preferB) {
    await context.entities.Transaction.update({
      where: { id: a.id },
      data: {
        categoryId: b.categoryId,
        subcategoryId: b.subcategoryId,
        categorySource: b.categorySource,
        confidenceScore: b.confidenceScore,
      },
    });
  }

  return { ok: true };
};

export const rejectRelatedPair: RejectRelatedPair<
  RejectRelatedArgs,
  { ok: true }
> = async (args, context) => {
  if (!args?.aId || !args?.bId) {
    throw new HttpError(400, "aId und bId sind erforderlich.");
  }
  if (args.aId === args.bId) {
    throw new HttpError(400, "Ungültiges Paar.");
  }

  const { low, high } = pairIds(args.aId, args.bId);
  await context.entities.RelatedRejection.upsert({
    where: {
      txIdLow_txIdHigh: { txIdLow: low, txIdHigh: high },
    },
    create: { txIdLow: low, txIdHigh: high },
    update: {},
  });

  return { ok: true };
};
