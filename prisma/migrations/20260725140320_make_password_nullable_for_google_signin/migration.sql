-- AlterTable
-- Make password field nullable for Google sign-in users
ALTER TABLE "owners" ALTER COLUMN "password_hash" DROP NOT NULL;
