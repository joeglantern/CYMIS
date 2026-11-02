-- Yards, and a yard and a shape on each section. Additive: nothing is renamed or dropped.

-- AlterTable
ALTER TABLE "sections" ADD COLUMN     "boundary" JSONB,
ADD COLUMN     "yardId" UUID;

-- CreateTable
CREATE TABLE "yards" (
    "id" UUID NOT NULL,
    "facilityId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "yards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "yards_facilityId_code_key" ON "yards"("facilityId", "code");

-- CreateIndex
CREATE INDEX "sections_yardId_idx" ON "sections"("yardId");

-- AddForeignKey
ALTER TABLE "yards" ADD CONSTRAINT "yards_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_yardId_fkey" FOREIGN KEY ("yardId") REFERENCES "yards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
