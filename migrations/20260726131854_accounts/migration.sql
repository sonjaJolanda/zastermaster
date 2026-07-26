-- CreateTable
CREATE TABLE "Account" (
    "id" SERIAL NOT NULL,
    "bank" TEXT NOT NULL,
    "konto" TEXT NOT NULL,
    "accountIban" TEXT NOT NULL DEFAULT '',
    "currentBalance" DECIMAL(12,2),
    "asOfDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_bank_konto_key" ON "Account"("bank", "konto");
