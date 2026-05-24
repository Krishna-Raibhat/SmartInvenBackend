-- Add operation and last_synced_at to SyncIdempotency
ALTER TABLE "sync_idempotency" ADD COLUMN "operation" VARCHAR(10) DEFAULT 'create';
ALTER TABLE "sync_idempotency" ADD COLUMN "last_synced_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add updated_at and deleted_at to grocery tables for soft deletes and sync tracking
-- Categories (already has updated_at)
ALTER TABLE "grocery_categories" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP NULL;

-- Brands (already has updated_at)
ALTER TABLE "grocery_brands" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP NULL;

-- Units (already has updated_at)
ALTER TABLE "grocery_units" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP NULL;

-- Suppliers
ALTER TABLE "grocery_suppliers" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "grocery_suppliers" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP NULL;

-- Products (already has updated_at)
ALTER TABLE "grocery_products" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP NULL;

-- Stock Lots
ALTER TABLE "grocery_stock_lots" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "grocery_stock_lots" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP NULL;

-- Sales
ALTER TABLE "grocery_sales" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "grocery_sales" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP NULL;

-- Customer Returns
ALTER TABLE "grocery_customer_returns" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "grocery_customer_returns" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP NULL;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS "idx_grocery_categories_deleted_at" ON "grocery_categories"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_grocery_brands_deleted_at" ON "grocery_brands"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_grocery_units_deleted_at" ON "grocery_units"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_grocery_suppliers_deleted_at" ON "grocery_suppliers"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_grocery_products_deleted_at" ON "grocery_products"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_grocery_stock_lots_deleted_at" ON "grocery_stock_lots"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_grocery_sales_deleted_at" ON "grocery_sales"("deleted_at");
CREATE INDEX IF NOT EXISTS "idx_grocery_customer_returns_deleted_at" ON "grocery_customer_returns"("deleted_at");

-- Create indexes for updated_at for efficient sync queries
CREATE INDEX IF NOT EXISTS "idx_grocery_categories_updated_at" ON "grocery_categories"("updated_at");
CREATE INDEX IF NOT EXISTS "idx_grocery_brands_updated_at" ON "grocery_brands"("updated_at");
CREATE INDEX IF NOT EXISTS "idx_grocery_units_updated_at" ON "grocery_units"("updated_at");
CREATE INDEX IF NOT EXISTS "idx_grocery_suppliers_updated_at" ON "grocery_suppliers"("updated_at");
CREATE INDEX IF NOT EXISTS "idx_grocery_products_updated_at" ON "grocery_products"("updated_at");
CREATE INDEX IF NOT EXISTS "idx_grocery_stock_lots_updated_at" ON "grocery_stock_lots"("updated_at");
CREATE INDEX IF NOT EXISTS "idx_grocery_sales_updated_at" ON "grocery_sales"("updated_at");
CREATE INDEX IF NOT EXISTS "idx_grocery_customer_returns_updated_at" ON "grocery_customer_returns"("updated_at");
