# Grocery Module Setup Summary

## ✅ Completed Tasks

### 1. Auth Controller Update
**File:** `src/controllers/authController.js`

Added "grocery" package support:
```javascript
const packageNameMap = {
  hardware: "Hardware Store",
  clothing: "Clothing Store",
  grocery: "Grocery Store",  // ✅ Added
};

const allowed = new Set(["hardware", "clothing", "grocery"]);  // ✅ Added
```

**Result:** Users can now register with `package_key: "grocery"`

---

### 2. Prisma Schema Update
**File:** `prisma/schema.prisma`

Added `grocerySuppliers` relation to Owner model:
```prisma
model Owner {
  // ... other fields
  grocerySuppliers        GrocerySupplier[]  // ✅ Added
  // ... other relations
}
```

**GrocerySupplier model** (already existed):
```prisma
model GrocerySupplier {
  supplier_id   String   @id @default(uuid())
  owner_id      String
  owner         Owner    @relation(fields: [owner_id], references: [owner_id], onDelete: Cascade)
  supplier_name String
  phone         String
  email         String?
  address       String?
  created_at    DateTime @default(now())
  
  @@unique([owner_id, phone])
  @@map("grocery_suppliers")
}
```

**Prisma Client:** ✅ Regenerated with `npx prisma generate`

---

### 3. Grocery Supplier Service
**File:** `src/services/grocerySupplierService.js` ✅ Created

Features:
- ✅ Create supplier with validation
- ✅ List all suppliers (owner-scoped)
- ✅ Get supplier by ID (owner-scoped)
- ✅ Update supplier with partial updates
- ✅ Delete supplier (with future stock lot check placeholder)
- ✅ Duplicate phone detection per owner
- ✅ Proper error handling with status codes

---

### 4. Grocery Supplier Controller
**File:** `src/controllers/grocerySupplierController.js` ✅ Created

Features:
- ✅ Phone validation using `normalizeNepalPhone()` and `isValidNepalPhone()`
- ✅ Email validation with regex
- ✅ Required field validation
- ✅ Proper error responses with error codes
- ✅ Owner-scoped operations (uses `req.owner.owner_id`)
- ✅ Consistent with clothing/hardware patterns

---

### 5. Grocery Supplier Routes
**File:** `src/routes/grocerySupplierRoutes.js` ✅ Created

Endpoints:
- ✅ `POST /api/grocery/suppliers` - Create
- ✅ `GET /api/grocery/suppliers` - List all
- ✅ `GET /api/grocery/suppliers/:supplier_id` - Get by ID
- ✅ `PUT /api/grocery/suppliers/:supplier_id` - Update
- ✅ `DELETE /api/grocery/suppliers/:supplier_id` - Delete

All routes protected with `authenticate` middleware.

---

### 6. App.js Integration
**File:** `src/app.js` ✅ Updated

Added:
```javascript
import grocerySupplierRoutes from "./routes/grocerySupplierRoutes.js";

// ...

app.use("/api/grocery/suppliers", grocerySupplierRoutes);
```

---

### 7. Documentation
**Files Created:**
- ✅ `GROCERY_SUPPLIER_API.md` - Complete API documentation
- ✅ `GROCERY_MODULE_SETUP.md` - This setup summary

---

## 🎯 What Works Now

### Registration
Users can register with grocery package:
```json
POST /api/auth/register
{
  "full_name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "Test@1234",
  "confirm_password": "Test@1234",
  "package_key": "grocery"
}
```

### Supplier Management
Full CRUD operations for grocery suppliers:
```bash
# Create
POST /api/grocery/suppliers
{
  "supplier_name": "Fresh Vegetables Ltd",
  "phone": "9841234567",
  "email": "fresh@example.com",
  "address": "Kalimati, Kathmandu"
}

# List
GET /api/grocery/suppliers

# Get by ID
GET /api/grocery/suppliers/:supplier_id

# Update
PUT /api/grocery/suppliers/:supplier_id
{
  "supplier_name": "Updated Name"
}

# Delete
DELETE /api/grocery/suppliers/:supplier_id
```

---

## 📋 Next Steps for Full Grocery Module

To complete the grocery module, you'll need to create:

### 1. GroceryCategory
```prisma
model GroceryCategory {
  category_id   String @id @default(uuid())
  owner_id      String
  owner         Owner  @relation(...)
  category_name String
  created_at    DateTime @default(now())
  
  products GroceryProduct[]
  
  @@unique([owner_id, category_name])
  @@map("grocery_categories")
}
```

### 2. GroceryProduct
```prisma
model GroceryProduct {
  product_id   String @id @default(uuid())
  owner_id     String
  owner        Owner  @relation(...)
  category_id  String?
  category     GroceryCategory? @relation(...)
  product_name String
  unit         String  // kg, liter, piece, etc.
  // ... other fields
  
  @@map("grocery_products")
}
```

### 3. GroceryStockLot
```prisma
model GroceryStockLot {
  lot_id      String @id @default(uuid())
  owner_id    String
  owner       Owner  @relation(...)
  supplier_id String
  supplier    GrocerySupplier @relation(...)
  product_id  String
  product     GroceryProduct @relation(...)
  qty_in      Int
  cp          Decimal  // cost price
  sp          Decimal  // selling price
  // ... other fields
  
  @@map("grocery_stock_lots")
}
```

### 4. GrocerySales
Similar to ClothingSales with items, payments, etc.

### 5. GroceryDashboard
Analytics and reporting services.

### 6. GroceryInventory
Stock tracking and management.

---

## 🔧 Pattern to Follow

For each new grocery module component:

1. **Create Prisma Model** in `schema.prisma`
2. **Run** `npx prisma generate`
3. **Create Service** in `src/services/grocery*.js`
4. **Create Controller** in `src/controllers/grocery*.js`
5. **Create Routes** in `src/routes/grocery*.js`
6. **Register Routes** in `src/app.js`
7. **Test** with Postman/curl

Follow the same validation patterns as clothing/hardware modules for consistency.

---

## ✅ Validation Patterns Used

### Phone Validation
```javascript
import { normalizeNepalPhone, isValidNepalPhone } from "../utils/phone.js";

phone = normalizeNepalPhone(phone);
if (!isValidNepalPhone(phone)) {
  return fail(res, 400, "VALIDATION_PHONE_INVALID", "Invalid phone number.");
}
```

### Email Validation
```javascript
const isValidEmail = (email) =>
  typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

if (email && !isValidEmail(email)) {
  return fail(res, 400, "VALIDATION_EMAIL_INVALID", "Invalid email format.");
}
```

### Required Fields
```javascript
if (!supplier_name || !phone) {
  return fail(res, 400, "VALIDATION_REQUIRED_FIELDS", "supplier_name and phone are required.");
}
```

### Owner Scoping
```javascript
const owner_id = req.owner.owner_id;  // From auth middleware

// All queries scoped to owner
await prisma.grocerySupplier.findMany({
  where: { owner_id },
  // ...
});
```

---

## 🚀 Ready to Use

The grocery supplier CRUD is fully functional and ready for testing. Start the server and test with:

```bash
# Start server
npm start

# Test registration with grocery package
# Test supplier CRUD operations
```

All endpoints follow the same patterns as clothing/hardware modules for consistency across the codebase.
