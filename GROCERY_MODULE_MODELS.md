# Grocery Module - Database Models

## Overview
The Grocery module supports both grocery stores and pharmacies with flexible inventory management including weight-based and countable items.

---

## Models Summary

### 1. **GrocerySupplier** ✅ (Owner-scoped)
Stores supplier information for purchasing stock.

**Fields:**
- `supplier_id` - UUID primary key
- `owner_id` - Foreign key to Owner
- `supplier_name` - Supplier name
- `phone` - Contact phone (Nepal format, unique per owner)
- `email` - Email address (optional)
- `address` - Physical address (optional)
- `created_at` - Timestamp

**Unique Constraint:** `[owner_id, phone]`

---

### 2. **GroceryCategory** ✅ (Global)
Product categories shared across all owners.

**Fields:**
- `category_id` - UUID primary key
- `category_name` - Category name (unique, lowercase)
- `created_at` - Timestamp
- `updated_at` - Timestamp

**Examples:** medicine, beverages, grains, dairy, snacks

---

### 3. **GroceryBrand** ✅ (Global)
Product brands shared across all owners.

**Fields:**
- `brand_id` - UUID primary key
- `brand_name` - Brand name (unique, lowercase)
- `created_at` - Timestamp
- `updated_at` - Timestamp

**Examples:** cipla, coca cola, nestle, himalaya

---

### 4. **GroceryUnit** ✅ (Owner-scoped)
Customizable units per owner for measuring products.

**Fields:**
- `unit_id` - UUID primary key
- `owner_id` - Foreign key to Owner
- `unit_name` - Unit name (unique per owner, lowercase)
- `created_at` - Timestamp
- `updated_at` - Timestamp

**Unique Constraint:** `[owner_id, unit_name]`

**Common Examples:**
- Countable: strip, bottle, piece, pack, box, dozen, carton
- Weight: kg, gram, mg
- Volume: liter, ml
- Pharmacy: vial, tube, sachet, capsule, tablet

---

### 5. **GroceryProduct** ✅ (Owner-scoped)
Products available in the inventory.

**Fields:**
- `product_id` - UUID primary key
- `owner_id` - Foreign key to Owner
- `category_id` - Foreign key to GroceryCategory (optional)
- `brand_id` - Foreign key to GroceryBrand (optional)
- `unit_id` - Foreign key to GroceryUnit (required)
- `product_name` - Full product name with details
- `barcode` - Product barcode (optional, unique globally)
- `description` - Product description (optional)
- `image_url` - Product image URL (optional)
- `min_stock_level` - Minimum stock alert threshold (optional)
- `created_at` - Timestamp
- `updated_at` - Timestamp

**Unique Constraint:** `[owner_id, product_name]`

**Product Name Examples:**
- Pharmacy: "Paracetamol 500mg Strip 10 Tablets"
- Grocery: "Coca Cola 1.5 Liter Bottle"
- Bulk: "Basmati Rice Premium 5kg Pack"

---

### 6. **GroceryStockLot** ✅ (Owner-scoped)
Individual stock purchases with batch tracking.

**Fields:**
- `lot_id` - UUID primary key
- `owner_id` - Foreign key to Owner
- `product_id` - Foreign key to GroceryProduct
- `supplier_id` - Foreign key to GrocerySupplier
- `qty_in` - **Decimal(10,3)** - Quantity purchased (supports fractions)
- `qty_remaining` - **Decimal(10,3)** - Current stock (supports fractions)
- `cp` - Decimal(10,2) - Cost price per unit
- `sp` - Decimal(10,2) - Selling price per unit
- `batch_no` - Batch number (optional, important for pharmacy)
- `expiry_date` - Expiry date (optional, important for pharmacy/grocery)
- `notes` - Additional notes (optional)
- `created_at` - Timestamp

**Why Decimal for Quantities?**
- Supports weight-based sales: 2.5 kg, 1.75 liters
- Supports fractional sales: 0.5 kg sugar, 0.25 liter oil
- Also works for whole numbers: 100.000 strips = 100 strips

**Examples:**
```javascript
// Pharmacy - Whole numbers
{
  product: "Paracetamol 500mg Strip",
  qty_in: 100.000,        // 100 strips
  qty_remaining: 75.000,  // 75 strips
  cp: 15.00,              // Rs. 15 per strip
  sp: 20.00,              // Rs. 20 per strip
  batch_no: "BATCH2026A123",
  expiry_date: "2027-12-31"
}

// Grocery - Weight-based
{
  product: "Basmati Rice Premium",
  qty_in: 50.000,         // 50 kg
  qty_remaining: 47.500,  // 47.5 kg (sold 2.5 kg)
  cp: 80.00,              // Rs. 80 per kg
  sp: 100.00,             // Rs. 100 per kg
  batch_no: "RICE2026MAY",
  expiry_date: null
}

// Grocery - Volume-based
{
  product: "Cooking Oil",
  qty_in: 20.000,         // 20 liters
  qty_remaining: 18.250,  // 18.25 liters (sold 1.75 liters)
  cp: 150.00,             // Rs. 150 per liter
  sp: 180.00,             // Rs. 180 per liter
  batch_no: "OIL2026APR",
  expiry_date: "2027-06-30"
}
```

---

## Database Tables Created

✅ `grocery_suppliers`
✅ `grocery_categories`
✅ `grocery_brands`
✅ `grocery_units`
✅ `grocery_products`
✅ `grocery_stock_lots`

---

## Relations Summary

```
Owner (1) ──→ (N) GrocerySupplier
Owner (1) ──→ (N) GroceryUnit
Owner (1) ──→ (N) GroceryProduct
Owner (1) ──→ (N) GroceryStockLot

GroceryCategory (1) ──→ (N) GroceryProduct (optional)
GroceryBrand (1) ──→ (N) GroceryProduct (optional)
GroceryUnit (1) ──→ (N) GroceryProduct (required)

GroceryProduct (1) ──→ (N) GroceryStockLot
GrocerySupplier (1) ──→ (N) GroceryStockLot
```

---

## Next Steps

1. ✅ Models created and pushed to database
2. ⏳ Create GroceryUnit CRUD (service, controller, routes)
3. ⏳ Create GroceryProduct CRUD (service, controller, routes)
4. ⏳ Create GroceryStockLot CRUD (service, controller, routes)
5. ⏳ Create Sales module for grocery
6. ⏳ Create Reports and Dashboard

---

## Key Design Decisions

1. **Unit Model (Owner-scoped):** Each owner can customize their own units
2. **Decimal Quantities:** Supports both weight-based (2.5 kg) and countable (100 pieces) items
3. **Product Name Contains Details:** "Paracetamol 500mg Strip 10 Tabs" instead of separate fields
4. **Batch & Expiry Tracking:** Critical for pharmacy compliance and grocery freshness
5. **Optional Category/Brand:** Flexibility for small stores that don't categorize
6. **Barcode Support:** For quick scanning and modern POS systems

---

Last Updated: May 15, 2026
