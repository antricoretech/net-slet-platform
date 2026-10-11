-- Durable, hashed, one-time authentication lifecycle tokens.
ALTER TYPE "AuditEventType" ADD VALUE 'ACCOUNT_EMAIL_VERIFIED';
ALTER TYPE "AuditEventType" ADD VALUE 'PASSWORD_RESET_REQUESTED';
ALTER TYPE "AuditEventType" ADD VALUE 'PASSWORD_RESET_COMPLETED';

CREATE TABLE "EmailVerificationToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "accountId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PasswordResetToken" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "accountId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "EmailVerificationToken"("tokenHash");
CREATE INDEX "EmailVerificationToken_accountId_expiresAt_idx" ON "EmailVerificationToken"("accountId", "expiresAt");
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_accountId_expiresAt_idx" ON "PasswordResetToken"("accountId", "expiresAt");

ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
