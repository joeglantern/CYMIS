-- AlterTable
ALTER TABLE "audit_assignments" ADD COLUMN     "viaShiftAt" TIMESTAMPTZ(3);

-- CreateTable
CREATE TABLE "audit_access_ended" (
    "auditId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "audit_access_ended_pkey" PRIMARY KEY ("auditId","userId")
);

-- CreateTable
CREATE TABLE "shifts" (
    "id" UUID NOT NULL,
    "auditId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shift_assignments" (
    "shiftId" UUID NOT NULL,
    "userId" UUID NOT NULL,

    CONSTRAINT "shift_assignments_pkey" PRIMARY KEY ("shiftId","userId")
);

-- CreateIndex
CREATE INDEX "audit_access_ended_userId_idx" ON "audit_access_ended"("userId");

-- CreateIndex
CREATE INDEX "shifts_auditId_startsAt_idx" ON "shifts"("auditId", "startsAt");

-- CreateIndex
CREATE INDEX "shifts_endsAt_idx" ON "shifts"("endsAt");

-- CreateIndex
CREATE INDEX "shift_assignments_userId_idx" ON "shift_assignments"("userId");

-- AddForeignKey
ALTER TABLE "audit_access_ended" ADD CONSTRAINT "audit_access_ended_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_access_ended" ADD CONSTRAINT "audit_access_ended_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "audits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
