-- CreateEnum
CREATE TYPE "owner_status" AS ENUM ('trial', 'active', 'inactive');

-- AlterTable
ALTER TABLE "owners" ADD COLUMN     "status" "owner_status" NOT NULL DEFAULT 'trial';
