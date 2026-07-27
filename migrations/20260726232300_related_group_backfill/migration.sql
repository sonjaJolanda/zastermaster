-- Backfill relatedGroupId for existing bidirectional pairs.
WITH pairs AS (
  SELECT LEAST(a.id, a."relatedTransactionId") AS low,
         GREATEST(a.id, a."relatedTransactionId") AS high
  FROM "Transaction" a
  JOIN "Transaction" b ON b.id = a."relatedTransactionId"
  WHERE a."relatedTransactionId" IS NOT NULL
    AND b."relatedTransactionId" = a.id
    AND a.id < b.id
    AND a."relatedGroupId" IS NULL
),
assigned AS (
  SELECT low, high, gen_random_uuid()::text AS gid
  FROM pairs
)
UPDATE "Transaction" t
SET "relatedGroupId" = assigned.gid
FROM assigned
WHERE t.id = assigned.low OR t.id = assigned.high;
