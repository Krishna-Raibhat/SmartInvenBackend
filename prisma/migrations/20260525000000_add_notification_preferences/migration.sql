-- Add is_enabled column to grocery_notifications for user preferences
ALTER TABLE "grocery_notifications" ADD COLUMN "is_enabled" BOOLEAN DEFAULT true;

-- Create index for efficient preference queries
CREATE INDEX "idx_grocery_notifications_is_enabled" ON "grocery_notifications"("owner_id", "is_enabled");
