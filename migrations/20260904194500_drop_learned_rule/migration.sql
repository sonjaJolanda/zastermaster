-- Remap leftover learned assignments, then drop unused rules.
UPDATE "Transaction" SET "categorySource" = 'manual' WHERE "categorySource" = 'learned';

DROP TABLE IF EXISTS "LearnedRule";
