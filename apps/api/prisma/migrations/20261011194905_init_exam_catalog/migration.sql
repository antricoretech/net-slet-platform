-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('STUDENT', 'SME', 'ADMIN');

-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('ACCOUNT_REGISTERED', 'LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'SESSION_REVOKED', 'ROLE_ACCESS_DENIED');

-- CreateTable
CREATE TABLE "Account" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "role" "AccountRole" NOT NULL DEFAULT 'STUDENT',
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "tokenHash" CHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(64),
    "userAgent" VARCHAR(512),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" UUID NOT NULL,
    "type" "AuditEventType" NOT NULL,
    "accountId" UUID,
    "ipAddress" VARCHAR(64),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_email_key" ON "Account"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_accountId_expiresAt_idx" ON "Session"("accountId", "expiresAt");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditEvent_accountId_createdAt_idx" ON "AuditEvent"("accountId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_type_createdAt_idx" ON "AuditEvent"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
