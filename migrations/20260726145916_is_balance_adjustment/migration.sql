-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "isBalanceAdjustment" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Transaction_bank_konto_datum_idx" ON "Transaction"("bank", "konto", "datum");
