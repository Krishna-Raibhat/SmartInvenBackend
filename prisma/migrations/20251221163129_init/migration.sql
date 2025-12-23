-- CreateTable
CREATE TABLE "packages" (
    "package_id" TEXT NOT NULL,
    "package_key" TEXT NOT NULL,
    "package_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("package_id")
);

-- CreateTable
CREATE TABLE "owners" (
    "owner_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "fcm_token" TEXT,
    "package_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owners_pkey" PRIMARY KEY ("owner_id")
);

-- CreateTable
CREATE TABLE "password_reset_otps" (
    "id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "wrong_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_sent_at" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "password_reset_otps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hardware_suppliers" (
    "supplier_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "supplier_name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hardware_suppliers_pkey" PRIMARY KEY ("supplier_id")
);

-- CreateTable
CREATE TABLE "hardware_categories" (
    "category_id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "category_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hardware_categories_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "hardware_products" (
    "product_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hardware_products_pkey" PRIMARY KEY ("product_id")
);

-- CreateTable
CREATE TABLE "hardware_stock_lots" (
    "lot_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "cp" DECIMAL(65,30) NOT NULL,
    "sp" DECIMAL(65,30) NOT NULL,
    "qty_in" INTEGER NOT NULL,
    "qty_remaining" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hardware_stock_lots_pkey" PRIMARY KEY ("lot_id")
);

-- CreateTable
CREATE TABLE "hardware_stock_out" (
    "stockout_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "payment_status" TEXT NOT NULL DEFAULT 'pending',
    "total_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hardware_stock_out_pkey" PRIMARY KEY ("stockout_id")
);

-- CreateTable
CREATE TABLE "hardware_stock_out_items" (
    "stockout_item_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "stockout_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "lot_id" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "cp" DECIMAL(65,30) NOT NULL,
    "sp" DECIMAL(65,30) NOT NULL,
    "note" TEXT,
    "line_total" DECIMAL(65,30) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hardware_stock_out_items_pkey" PRIMARY KEY ("stockout_item_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "packages_package_key_key" ON "packages"("package_key");

-- CreateIndex
CREATE UNIQUE INDEX "owners_email_key" ON "owners"("email");

-- CreateIndex
CREATE UNIQUE INDEX "owners_phone_key" ON "owners"("phone");

-- CreateIndex
CREATE INDEX "password_reset_otps_owner_id_idx" ON "password_reset_otps"("owner_id");

-- CreateIndex
CREATE INDEX "password_reset_otps_email_idx" ON "password_reset_otps"("email");

-- CreateIndex
CREATE INDEX "password_reset_otps_expires_at_idx" ON "password_reset_otps"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "hardware_suppliers_owner_id_phone_key" ON "hardware_suppliers"("owner_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "hardware_categories_package_id_category_name_key" ON "hardware_categories"("package_id", "category_name");

-- CreateIndex
CREATE UNIQUE INDEX "hardware_products_owner_id_product_name_key" ON "hardware_products"("owner_id", "product_name");

-- CreateIndex
CREATE INDEX "hardware_stock_lots_owner_id_product_id_idx" ON "hardware_stock_lots"("owner_id", "product_id");

-- CreateIndex
CREATE INDEX "hardware_stock_lots_owner_id_supplier_id_idx" ON "hardware_stock_lots"("owner_id", "supplier_id");

-- CreateIndex
CREATE INDEX "hardware_stock_out_owner_id_idx" ON "hardware_stock_out"("owner_id");

-- CreateIndex
CREATE INDEX "hardware_stock_out_items_owner_id_stockout_id_idx" ON "hardware_stock_out_items"("owner_id", "stockout_id");

-- CreateIndex
CREATE INDEX "hardware_stock_out_items_owner_id_product_id_idx" ON "hardware_stock_out_items"("owner_id", "product_id");

-- CreateIndex
CREATE INDEX "hardware_stock_out_items_owner_id_lot_id_idx" ON "hardware_stock_out_items"("owner_id", "lot_id");

-- AddForeignKey
ALTER TABLE "owners" ADD CONSTRAINT "owners_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("package_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_otps" ADD CONSTRAINT "password_reset_otps_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_suppliers" ADD CONSTRAINT "hardware_suppliers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_categories" ADD CONSTRAINT "hardware_categories_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("package_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_products" ADD CONSTRAINT "hardware_products_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_products" ADD CONSTRAINT "hardware_products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "hardware_categories"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_stock_lots" ADD CONSTRAINT "hardware_stock_lots_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_stock_lots" ADD CONSTRAINT "hardware_stock_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "hardware_products"("product_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_stock_lots" ADD CONSTRAINT "hardware_stock_lots_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "hardware_suppliers"("supplier_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_stock_out" ADD CONSTRAINT "hardware_stock_out_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_stock_out_items" ADD CONSTRAINT "hardware_stock_out_items_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "owners"("owner_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_stock_out_items" ADD CONSTRAINT "hardware_stock_out_items_stockout_id_fkey" FOREIGN KEY ("stockout_id") REFERENCES "hardware_stock_out"("stockout_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_stock_out_items" ADD CONSTRAINT "hardware_stock_out_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "hardware_products"("product_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hardware_stock_out_items" ADD CONSTRAINT "hardware_stock_out_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "hardware_stock_lots"("lot_id") ON DELETE RESTRICT ON UPDATE CASCADE;
