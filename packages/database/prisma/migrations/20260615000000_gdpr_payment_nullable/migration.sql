-- GDPR: Make Payment sender/recipient nullable for right-to-erasure anonymisation.
-- Financial audit requires payment records to persist; FKs are nulled on account deletion.
ALTER TABLE "Payment" ALTER COLUMN "senderId" DROP NOT NULL;
ALTER TABLE "Payment" ALTER COLUMN "recipientId" DROP NOT NULL;

-- Audit trail for GDPR deletion requests.
-- Deliberately has no FK to "User" so the record survives after user deletion.
CREATE TABLE "UserDeletionLog" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "deletedAt" TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestIp" TEXT         NOT NULL,
    CONSTRAINT "UserDeletionLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserDeletionLog_userId_idx"    ON "UserDeletionLog"("userId");
CREATE INDEX "UserDeletionLog_deletedAt_idx" ON "UserDeletionLog"("deletedAt");
