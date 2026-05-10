# Grocery Supplier API Documentation

## Overview
Complete CRUD operations for grocery suppliers with validation matching the clothing supplier pattern.

## Base URL
```
/api/grocery/suppliers
```

## Authentication
All endpoints require authentication via JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

---

## Endpoints

### 1. Create Supplier
**POST** `/api/grocery/suppliers`

Creates a new grocery supplier for the authenticated owner.

**Request Body:**
```json
{
  "supplier_name": "ABC Grocery Wholesale",
  "phone": "9841234567",
  "email": "abc@example.com",
  "address": "Kathmandu, Nepal"
}
```

**Required Fields:**
- `supplier_name` (string)
- `phone` (string) - Must be valid Nepali phone number

**Optional Fields:**
- `email` (string) - Must be valid email format
- `address` (string)

**Validation:**
- Phone number is normalized and validated for Nepal format
- Email format is validated if provided
- Phone must be unique per owner (@@unique constraint)

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "supplier_id": "uuid",
    "owner_id": "uuid",
    "supplier_name": "ABC Grocery Wholesale",
    "phone": "9841234567",
    "email": "abc@example.com",
    "address": "Kathmandu, Nepal",
    "created_at": "2026-05-10T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400 VALIDATION_REQUIRED_FIELDS` - Missing required fields
- `400 VALIDATION_PHONE_INVALID` - Invalid phone number
- `400 VALIDATION_EMAIL_INVALID` - Invalid email format
- `409 SUPPLIER_PHONE_ALREADY_IN_USE` - Phone already exists for this owner

---

### 2. List All Suppliers
**GET** `/api/grocery/suppliers`

Retrieves all grocery suppliers for the authenticated owner.

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "supplier_id": "uuid",
      "owner_id": "uuid",
      "supplier_name": "ABC Grocery Wholesale",
      "phone": "9841234567",
      "email": "abc@example.com",
      "address": "Kathmandu, Nepal",
      "created_at": "2026-05-10T10:30:00.000Z"
    }
  ]
}
```

**Notes:**
- Results are ordered by `created_at` descending (newest first)
- Only returns suppliers belonging to the authenticated owner

---

### 3. Get Supplier by ID
**GET** `/api/grocery/suppliers/:supplier_id`

Retrieves a specific grocery supplier by ID.

**URL Parameters:**
- `supplier_id` (uuid) - The supplier's unique identifier

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "supplier_id": "uuid",
    "owner_id": "uuid",
    "supplier_name": "ABC Grocery Wholesale",
    "phone": "9841234567",
    "email": "abc@example.com",
    "address": "Kathmandu, Nepal",
    "created_at": "2026-05-10T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `404 NOT_FOUND` - Supplier not found or doesn't belong to owner

---

### 4. Update Supplier
**PUT** `/api/grocery/suppliers/:supplier_id`

Updates an existing grocery supplier. All fields are optional.

**URL Parameters:**
- `supplier_id` (uuid) - The supplier's unique identifier

**Request Body (all optional):**
```json
{
  "supplier_name": "Updated Name",
  "phone": "9851234567",
  "email": "newemail@example.com",
  "address": "New Address"
}
```

**Notes:**
- At least one field must be provided
- Email can be set to `null` to clear it
- Address can be set to `null` to clear it
- Phone validation applies if phone is being updated
- Email validation applies if email is being updated

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "supplier_id": "uuid",
    "owner_id": "uuid",
    "supplier_name": "Updated Name",
    "phone": "9851234567",
    "email": "newemail@example.com",
    "address": "New Address",
    "created_at": "2026-05-10T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400 VALIDATION_NO_FIELDS` - No fields provided for update
- `400 VALIDATION_PHONE_INVALID` - Invalid phone number
- `400 VALIDATION_EMAIL_INVALID` - Invalid email format
- `404 NOT_FOUND` - Supplier not found or doesn't belong to owner
- `409 SUPPLIER_PHONE_ALREADY_IN_USE` - Phone already exists for this owner

---

### 5. Delete Supplier
**DELETE** `/api/grocery/suppliers/:supplier_id`

Deletes a grocery supplier.

**URL Parameters:**
- `supplier_id` (uuid) - The supplier's unique identifier

**Success Response (200):**
```json
{
  "success": true,
  "message": "Supplier deleted successfully"
}
```

**Error Responses:**
- `404 NOT_FOUND` - Supplier not found or doesn't belong to owner
- `409 DELETE_BLOCKED` - Cannot delete supplier linked to stock lots (when GroceryStockLot is implemented)

**Notes:**
- Currently allows deletion without checking stock lots
- Will be updated to block deletion when GroceryStockLot model is created

---

## Validation Rules

### Phone Number
- Must be a valid Nepali phone number
- Automatically normalized using `normalizeNepalPhone()`
- Validated using `isValidNepalPhone()`
- Must be unique per owner

### Email
- Must match standard email regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- Optional field
- Can be cleared by setting to `null`

### Supplier Name
- Required field
- Trimmed of whitespace

### Address
- Optional field
- Can be cleared by setting to `null`

---

## Database Schema

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

---

## Testing Examples

### Create Supplier
```bash
curl -X POST http://localhost:3000/api/grocery/suppliers \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_name": "Fresh Vegetables Ltd",
    "phone": "9841234567",
    "email": "fresh@example.com",
    "address": "Kalimati, Kathmandu"
  }'
```

### List Suppliers
```bash
curl -X GET http://localhost:3000/api/grocery/suppliers \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Supplier by ID
```bash
curl -X GET http://localhost:3000/api/grocery/suppliers/SUPPLIER_UUID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Supplier
```bash
curl -X PUT http://localhost:3000/api/grocery/suppliers/SUPPLIER_UUID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_name": "Updated Name",
    "phone": "9851234567"
  }'
```

### Delete Supplier
```bash
curl -X DELETE http://localhost:3000/api/grocery/suppliers/SUPPLIER_UUID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Implementation Files

- **Service:** `src/services/grocerySupplierService.js`
- **Controller:** `src/controllers/grocerySupplierController.js`
- **Routes:** `src/routes/grocerySupplierRoutes.js`
- **Schema:** `prisma/schema.prisma` (GrocerySupplier model)

---

## Future Enhancements

When implementing the full grocery module, you'll need:

1. **GroceryStockLot** - Track stock purchases from suppliers
2. **GroceryProduct** - Product catalog
3. **GroceryCategory** - Product categorization
4. **GrocerySales** - Sales transactions
5. **GroceryInventory** - Stock tracking
6. **GroceryDashboard** - Analytics and reports

The supplier CRUD is ready and follows the same pattern as clothing/hardware modules for consistency.
