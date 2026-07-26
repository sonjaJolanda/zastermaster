-- CreateEnum
CREATE TYPE "RelatedType" AS ENUM ('paypal_bank', 'transfer', 'near_duplicate');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "relatedTransactionId" INTEGER,
ADD COLUMN     "relatedType" "RelatedType";

-- CreateTable
CREATE TABLE "RelatedRejection" (
    "id" SERIAL NOT NULL,
    "txIdLow" INTEGER NOT NULL,
    "txIdHigh" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelatedRejection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RelatedRejection_txIdLow_txIdHigh_key" ON "RelatedRejection"("txIdLow", "txIdHigh");

-- CreateIndex
CREATE INDEX "Transaction_relatedTransactionId_idx" ON "Transaction"("relatedTransactionId");
