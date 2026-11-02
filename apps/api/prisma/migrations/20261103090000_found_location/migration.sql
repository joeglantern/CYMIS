-- Where a clerk says a box really is, and what a supervisor decided. Additive only.

-- CreateEnum
CREATE TYPE "LocationDecision" AS ENUM ('LIST_UPDATED', 'MOVE_BACK');

-- AlterEnum
ALTER TYPE "ScanFlag" ADD VALUE 'LOCATION_MISMATCH';

-- AlterTable
ALTER TABLE "scans" ADD COLUMN     "foundLocation" TEXT,
ADD COLUMN     "locationDecision" "LocationDecision";

-- CreateIndex
CREATE INDEX "scans_auditId_locationDecision_idx" ON "scans"("auditId", "locationDecision");
