-- AlterEnum
ALTER TYPE "RelatedType" ADD VALUE 'paypal_purchase';

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "relatedGroupId" TEXT;

-- CreateIndex
CREATE INDEX "Transaction_relatedGroupId_idx" ON "Transaction"("relatedGroupId");
