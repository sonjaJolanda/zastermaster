-- CreateTable
CREATE TABLE "Transaction" (
    "id" SERIAL NOT NULL,
    "datum" DATE NOT NULL,
    "betrag" DECIMAL(12,2) NOT NULL,
    "sender" TEXT NOT NULL DEFAULT '',
    "empfaenger" TEXT NOT NULL DEFAULT '',
    "verwendungszweck" TEXT NOT NULL DEFAULT '',
    "iban" TEXT NOT NULL DEFAULT '',
    "kundenreferenz" TEXT NOT NULL DEFAULT '',
    "bank" TEXT NOT NULL,
    "konto" TEXT NOT NULL,
    "balance" DECIMAL(12,2),
    "categoryId" INTEGER,
    "subcategoryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transaction_datum_idx" ON "Transaction"("datum" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_bank_konto_datum_betrag_verwendungszweck_iban_k_key" ON "Transaction"("bank", "konto", "datum", "betrag", "verwendungszweck", "iban", "kundenreferenz");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "Subcategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
