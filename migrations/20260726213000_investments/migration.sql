-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "isInvestment" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Transaction_isInvestment_idx" ON "Transaction"("isInvestment");

-- CreateTable
CREATE TABLE "InvestmentKeyword" (
    "id" SERIAL NOT NULL,
    "keyword" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentKeyword_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentRejection" (
    "id" SERIAL NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvestmentRejection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentKeyword_keyword_key" ON "InvestmentKeyword"("keyword");

-- CreateIndex
CREATE UNIQUE INDEX "InvestmentRejection_transactionId_key" ON "InvestmentRejection"("transactionId");
