-- Reconcile notification fields required by the dispatcher.
-- This migration is intentionally incremental and safe to run if some fields
-- were already added by an earlier deployment.

ALTER TABLE "Reminder"
  ADD COLUMN IF NOT EXISTS "sourceType" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Reminder_sourceKey_key" ON "Reminder"("sourceKey");

ALTER TABLE "MoneyEntry"
  ADD COLUMN IF NOT EXISTS "contactReminderEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "contactWhatsAppEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "contactSmsEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "contactReminderConsentAt" TIMESTAMP(3);

ALTER TABLE "NotificationPreference"
  ADD COLUMN IF NOT EXISTS "emailConsentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "whatsappConsentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "smsConsentAt" TIMESTAMP(3);

ALTER TABLE "BirthdayWish"
  ADD COLUMN IF NOT EXISTS "whatsappConsentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "smsConsentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "emailConsentAt" TIMESTAMP(3);

ALTER TABLE "NotificationDelivery"
  ADD COLUMN IF NOT EXISTS "moneyEntryId" TEXT;

CREATE INDEX IF NOT EXISTS "NotificationDelivery_moneyEntryId_idx"
  ON "NotificationDelivery"("moneyEntryId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'NotificationDelivery_moneyEntryId_fkey'
  ) THEN
    ALTER TABLE "NotificationDelivery"
      ADD CONSTRAINT "NotificationDelivery_moneyEntryId_fkey"
      FOREIGN KEY ("moneyEntryId") REFERENCES "MoneyEntry"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
