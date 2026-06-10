-- Drop table if exists (from failed migrations)
DROP TABLE IF EXISTS "grocery_inventory_losses" CASCADE;

-- CreateTable
CREATE TABLE "grocery_inventory_losses" (
    "loss_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "qty" DECIMAL(10,3) NOT NULL,
    "cp" DECIMAL(10,2) NOT NULL,
    "loss_amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "grocery_inventory_losses_pkey" PRIMARY KEY ("loss_id")
);

-- CreateIndex
CREATE INDEX "idx_grocery_losses_owner" ON "grocery_inventory_losses"("owner_id");

-- CreateIndex
CREATE INDEX "idx_grocery_losses_created" ON "grocery_inventory_losses"("created_at");

-- CreateIndex
CREATE INDEX "idx_grocery_losses_reason" ON "grocery_inventory_losses"("reason");

-- CreateIndex
CREATE INDEX "idx_grocery_losses_product" ON "grocery_inventory_losses"("product_id");

-- AddForeignKey
ALTER TABLE "grocery_inventory_losses" ADD CONSTRAINT "grocery_inventory_losses_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grocery_inventory_losses" ADD CONSTRAINT "grocery_inventory_losses_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "grocery_stock_lots"("lot_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grocery_inventory_losses" ADD CONSTRAINT "grocery_inventory_losses_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "grocery_products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;
