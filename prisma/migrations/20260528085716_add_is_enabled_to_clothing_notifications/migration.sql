-- AlterTable
ALTER TABLE "clothing_notifications" ADD COLUMN "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "clothing_notifications_owner_id_is_enabled_idx" ON "clothing_notifications"("owner_id", "is_enabled");
