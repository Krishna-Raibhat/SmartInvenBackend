-- CreateTable
CREATE TABLE "hardware_notifications" (
    "notification_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "product_id" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hardware_notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateIndex
CREATE INDEX "hardware_notifications_owner_id_created_at_idx" ON "hardware_notifications"("owner_id", "created_at");

-- CreateIndex
CREATE INDEX "hardware_notifications_owner_id_read_at_idx" ON "hardware_notifications"("owner_id", "read_at");

-- AddForeignKey
ALTER TABLE "hardware_notifications" ADD CONSTRAINT "hardware_notifications_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_notifications" ADD CONSTRAINT "hardware_notifications_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "hardware_products"("product_id") ON DELETE SET NULL ON UPDATE CASCADE;
