-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN     "shareId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Quiz_shareId_key" ON "Quiz"("shareId");

