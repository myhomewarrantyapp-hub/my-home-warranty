-- Initial PostgreSQL schema for My Home Warranty.
-- Generated to match backend/prisma/schema.prisma (Prisma 6).
CREATE TYPE "UserRole" AS ENUM ('USER', 'SUPPORT', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'PENDING', 'COMPLETED', 'CANCELLED');

CREATE TABLE "User" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "mobile" TEXT,
  "passwordHash" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'USER',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_mobile_key" ON "User"("mobile");

CREATE TABLE "Asset" (
  "id" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "category" TEXT NOT NULL, "purchaseDate" TIMESTAMP(3), "warrantyEnd" TIMESTAMP(3),
  "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Asset_ownerUserId_createdAt_idx" ON "Asset"("ownerUserId","createdAt");

CREATE TABLE "Vehicle" (
  "id" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL, "nickname" TEXT NOT NULL,
  "makeModel" TEXT, "registrationLastFour" TEXT, "currentOdometer" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Vehicle_ownerUserId_idx" ON "Vehicle"("ownerUserId");

CREATE TABLE "VehicleEvent" (
  "id" TEXT NOT NULL, "vehicleId" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL, "eventDate" TIMESTAMP(3) NOT NULL, "odometer" INTEGER,
  "cost" DECIMAL(12,2), "notes" TEXT, "nextDueDate" TIMESTAMP(3),
  "nextDueOdometer" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VehicleEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VehicleEvent_ownerUserId_vehicleId_eventDate_idx" ON "VehicleEvent"("ownerUserId","vehicleId","eventDate");

CREATE TABLE "Bill" (
  "id" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL, "billType" TEXT NOT NULL,
  "provider" TEXT, "amount" DECIMAL(12,2) NOT NULL, "billDate" TIMESTAMP(3),
  "dueDate" TIMESTAMP(3) NOT NULL, "status" "RecordStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Bill_ownerUserId_dueDate_idx" ON "Bill"("ownerUserId","dueDate");

CREATE TABLE "MoneyEntry" (
  "id" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL, "direction" TEXT NOT NULL,
  "personName" TEXT NOT NULL, "mobile" TEXT, "amount" DECIMAL(12,2) NOT NULL,
  "entryDate" TIMESTAMP(3) NOT NULL, "dueDate" TIMESTAMP(3),
  "interestRate" DECIMAL(7,3), "balance" DECIMAL(12,2) NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'PENDING', "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MoneyEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MoneyEntry_ownerUserId_dueDate_idx" ON "MoneyEntry"("ownerUserId","dueDate");

CREATE TABLE "PaymentRequest" (
  "id" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL, "recipientName" TEXT NOT NULL,
  "recipientMobile" TEXT, "amount" DECIMAL(12,2) NOT NULL, "purpose" TEXT,
  "status" TEXT NOT NULL DEFAULT 'CREATED', "providerReference" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaymentRequest_ownerUserId_status_idx" ON "PaymentRequest"("ownerUserId","status");

CREATE TABLE "InsurancePolicy" (
  "id" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL, "insurer" TEXT NOT NULL,
  "policyType" TEXT NOT NULL, "policyNumberEncrypted" TEXT, "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3), "premiumAmount" DECIMAL(12,2), "premiumDue" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InsurancePolicy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "InsurancePolicy_ownerUserId_endDate_idx" ON "InsurancePolicy"("ownerUserId","endDate");

CREATE TABLE "Document" (
  "id" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL, "storageKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL,
  "checksumSha256" TEXT NOT NULL, "scanStatus" TEXT NOT NULL DEFAULT 'PENDING_SCAN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");
CREATE INDEX "Document_ownerUserId_createdAt_idx" ON "Document"("ownerUserId","createdAt");

CREATE TABLE "Reminder" (
  "id" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL, "title" TEXT NOT NULL,
  "description" TEXT, "dueAt" TIMESTAMP(3) NOT NULL, "remindAt" TIMESTAMP(3) NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'PENDING', "deliveryStatus" TEXT NOT NULL DEFAULT 'QUEUED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Reminder_ownerUserId_remindAt_idx" ON "Reminder"("ownerUserId","remindAt");

CREATE TABLE "AuditEvent" (
  "id" TEXT NOT NULL, "actorUserId" TEXT NOT NULL, "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL, "entityId" TEXT, "outcome" TEXT NOT NULL DEFAULT 'SUCCESS',
  "ipAddress" TEXT, "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditEvent_actorUserId_createdAt_idx" ON "AuditEvent"("actorUserId","createdAt");

CREATE TABLE "SupportTicket" (
  "id" TEXT NOT NULL, "ownerUserId" TEXT NOT NULL, "subject" TEXT NOT NULL,
  "message" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SupportTicket_ownerUserId_status_idx" ON "SupportTicket"("ownerUserId","status");

CREATE TABLE "SiteControl" (
  "id" TEXT NOT NULL DEFAULT 'main', "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
  "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
  "notice" TEXT NOT NULL DEFAULT 'The website is temporarily unavailable. Please try again later.',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SiteControl_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VehicleEvent" ADD CONSTRAINT "VehicleEvent_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MoneyEntry" ADD CONSTRAINT "MoneyEntry_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentRequest" ADD CONSTRAINT "PaymentRequest_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InsurancePolicy" ADD CONSTRAINT "InsurancePolicy_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
