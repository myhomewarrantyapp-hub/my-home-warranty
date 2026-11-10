-- Allow birthdays and any other scheduled personal occasion wishes.
ALTER TABLE "BirthdayWish"
  ADD COLUMN IF NOT EXISTS "wishType" TEXT NOT NULL DEFAULT 'BIRTHDAY';
ALTER TABLE "BirthdayWish"
  ALTER COLUMN "birthDate" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "BirthdayWish_ownerUserId_wishType_scheduledAt_idx"
  ON "BirthdayWish"("ownerUserId","wishType","scheduledAt");
