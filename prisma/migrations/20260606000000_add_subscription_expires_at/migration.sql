-- AlterTable
ALTER TABLE "owners" ADD COLUMN IF NOT EXISTS "subscription_expires_at" TIMESTAMP(3);
