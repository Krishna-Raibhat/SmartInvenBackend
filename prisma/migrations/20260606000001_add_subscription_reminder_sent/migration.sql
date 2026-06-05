-- AlterTable
ALTER TABLE "owners" ADD COLUMN IF NOT EXISTS "subscription_reminder_sent" BOOLEAN NOT NULL DEFAULT false;
