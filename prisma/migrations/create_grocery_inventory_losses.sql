-- Migration: Create grocery_inventory_losses table
-- Purpose: Track damaged, expired, or spoiled inventory write-offs

CREATE TABLE IF NOT EXISTS grocery_inventory_losses (
  loss_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL,
  lot_id UUID NOT NULL,
  product_id UUID NOT NULL,
  qty DECIMAL(10,3) NOT NULL,
  cp DECIMAL(10,2) NOT NULL,
  loss_amount DECIMAL(10,2) NOT NULL,
  reason VARCHAR(50) NOT NULL CHECK (reason IN ('expired', 'damaged', 'spoiled', 'other')),
  note TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT fk_loss_owner FOREIGN KEY (owner_id) REFERENCES owners(owner_id) ON DELETE CASCADE,
  CONSTRAINT fk_loss_lot FOREIGN KEY (lot_id) REFERENCES grocery_stock_lots(lot_id) ON DELETE CASCADE,
  CONSTRAINT fk_loss_product FOREIGN KEY (product_id) REFERENCES grocery_products(product_id) ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_grocery_losses_owner ON grocery_inventory_losses(owner_id);
CREATE INDEX idx_grocery_losses_created ON grocery_inventory_losses(created_at);
CREATE INDEX idx_grocery_losses_reason ON grocery_inventory_losses(reason);
CREATE INDEX idx_grocery_losses_product ON grocery_inventory_losses(product_id);

-- Add comment
COMMENT ON TABLE grocery_inventory_losses IS 'Records inventory write-offs due to expiry, damage, or spoilage';
