-- CreateEnum
CREATE TYPE "CategorySource" AS ENUM ('manual', 'learned', 'keyword', 'none');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "categorySource" "CategorySource" NOT NULL DEFAULT 'none',
ADD COLUMN     "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0;
