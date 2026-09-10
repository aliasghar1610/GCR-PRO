-- AlterTable
ALTER TABLE "User" ADD COLUMN     "alertLeadHours" INTEGER NOT NULL DEFAULT 48,
ADD COLUMN     "alertsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "program" TEXT,
ADD COLUMN     "rollNumber" TEXT;
