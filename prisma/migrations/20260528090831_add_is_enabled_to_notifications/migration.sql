-- AlterTable: Add is_enabled to HardwareNotification
ALTER TABLE "hardware_notifications" ADD COLUMN "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex: hardware_notifications
CREATE INDEX "hardware_notifications_owner_id_is_enabled_idx" ON "hardware_notifications"("owner_id", "is_enabled");

-- AlterTable: Add is_enabled to ClothingNotification
ALTER TABLE "clothing_notifications" ADD COLUMN "is_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex: clothing_notifications
CREATE INDEX "clothing_notifications_owner_id_is_enabled_idx" ON "clothing_notifications"("owner_id", "is_enabled");

-- AlterTable: Add is_enabled to GroceryNotification (if not already present)
-- Note: GroceryNotification already has is_enabled field from previous migration
-- This is just for reference
