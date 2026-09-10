-- AlterTable
ALTER TABLE "User" ADD COLUMN     "extensionTokenHash" TEXT,
ADD COLUMN     "extensionTokenIssuedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ApiUsage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ApiUsage_userId_route_createdAt_idx" ON "ApiUsage"("userId", "route", "createdAt");
