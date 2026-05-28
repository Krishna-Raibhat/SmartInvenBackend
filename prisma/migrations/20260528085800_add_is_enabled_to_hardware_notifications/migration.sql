-- AlterTable
ALTER TABLE "hardware_notifications" ADD COLUMN "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "hardware_notifications_owner_id_is_enabled_idx" ON "hardware_notifications"("owner_id", "is_enabled");
