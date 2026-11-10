-- Notification opt-ins, scheduled birthday wishes and a retryable outbox.
-- Only the private backend database role may access these records directly.

CREATE TABLE "NotificationPreference" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
  "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "emailConsentAt" TIMESTAMP(3),
  "whatsappConsentAt" TIMESTAMP(3),
  "smsConsentAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BirthdayWish" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "recipientName" TEXT NOT NULL,
  "recipientMobile" TEXT,
  "recipientEmail" TEXT,
  "birthDate" TIMESTAMP(3) NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  "message" TEXT,
  "recurringYearly" BOOLEAN NOT NULL DEFAULT false,
  "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false,
  "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
  "whatsappConsent" BOOLEAN NOT NULL DEFAULT false,
  "smsConsent" BOOLEAN NOT NULL DEFAULT false,
  "emailConsent" BOOLEAN NOT NULL DEFAULT false,
  "whatsappConsentAt" TIMESTAMP(3),
  "smsConsentAt" TIMESTAMP(3),
  "emailConsentAt" TIMESTAMP(3),
  "mediaPath" TEXT,
  "mediaContentType" TEXT,
  "mediaOriginalName" TEXT,
  "mediaShareTokenHash" TEXT,
  "mediaShareExpiresAt" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
  "deliveryNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BirthdayWish_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "reminderId" TEXT,
  "birthdayWishId" TEXT,
  "channel" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT,
  "message" TEXT NOT NULL,
  "scheduledAt" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "providerMessageId" TEXT,
  "lastError" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationPreference_ownerUserId_key" ON "NotificationPreference"("ownerUserId");
CREATE INDEX "BirthdayWish_ownerUserId_scheduledAt_idx" ON "BirthdayWish"("ownerUserId","scheduledAt");
CREATE INDEX "BirthdayWish_status_scheduledAt_idx" ON "BirthdayWish"("status","scheduledAt");
CREATE UNIQUE INDEX "BirthdayWish_mediaShareTokenHash_key" ON "BirthdayWish"("mediaShareTokenHash");
CREATE UNIQUE INDEX "NotificationDelivery_idempotencyKey_key" ON "NotificationDelivery"("idempotencyKey");
CREATE INDEX "NotificationDelivery_status_nextAttemptAt_idx" ON "NotificationDelivery"("status","nextAttemptAt");
CREATE INDEX "NotificationDelivery_ownerUserId_createdAt_idx" ON "NotificationDelivery"("ownerUserId","createdAt");
CREATE INDEX "NotificationDelivery_reminderId_idx" ON "NotificationDelivery"("reminderId");
CREATE INDEX "NotificationDelivery_birthdayWishId_idx" ON "NotificationDelivery"("birthdayWishId");

ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BirthdayWish" ADD CONSTRAINT "BirthdayWish_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_reminderId_fkey"
  FOREIGN KEY ("reminderId") REFERENCES "Reminder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_birthdayWishId_fkey"
  FOREIGN KEY ("birthdayWishId") REFERENCES "BirthdayWish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationPreference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BirthdayWish" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationDelivery" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE "NotificationPreference","BirthdayWish","NotificationDelivery" FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL PRIVILEGES ON TABLE "NotificationPreference","BirthdayWish","NotificationDelivery" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL PRIVILEGES ON TABLE "NotificationPreference","BirthdayWish","NotificationDelivery" FROM authenticated;
  END IF;
END $$;

-- On hosted Supabase these extensions are available and enable minute-level dispatch.
-- Plain CI PostgreSQL images do not ship them, so CI safely skips this optional setup.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='pg_cron') THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name='pg_net') THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_net';
  END IF;
END $$;
