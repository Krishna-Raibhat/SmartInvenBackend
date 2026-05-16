# Grocery Unit API Documentation

## Overview
The Grocery Unit API allows owners to manage customizable units for their products (e.g., strip, bottle, kg, liter).

**Base URL:** `/api/grocery/units`

**Authentication:** All endpoints require JWT token in Authorization header

---

## Endpoints

### 1. Create Unit
Create a new unit for the authenticated owner.

**Endpoint:** `POST /api/grocery/units`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "unit_name": "Strip"
}
```

**Validation Rules:**
- `unit_name` is required
- Must be a string
- Cannot be empty after trimming
- Maximum 50 characters
- Can only contain: letters, numbers, spaces, hyphens (-), slashes (/), dots (.)
- Automatically converted to lowercase
- Must be unique per owner

**Success Response (201):**
```json
{
  "success": true,
  "message": "Unit created successfully",
  "data": {
    "unit_id": "uuid",
    "owner_id": "uuid",
    "unit_name": "strip",
    "created_at": "2026-05-15T10:30:00.000Z",
    "updated_at": "2026-05-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Validation error (empty name, invalid characters, too long)
- `409` - Unit already exists
- `500` - Server error

---

### 2. Get All Units
Retrieve all units for the authenticated owner.

**Endpoint:** `GET /api/grocery/units`

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Units retrieved successfully",
  "data": [
    {
      "unit_id": "uuid-1",
      "owner_id": "uuid",
      "unit_name": "bottle",
      "created_at": "2026-05-15T10:30:00.000Z",
      "updated_at": "2026-05-15T10:30:00.000Z"
    },
    {
      "unit_id": "uuid-2",
      "owner_id": "uuid",
      "unit_name": "kg",
      "created_at": "2026-05-15T10:31:00.000Z",
      "updated_at": "2026-05-15T10:31:00.000Z"
    },
    {
      "unit_id": "uuid-3",
      "owner_id": "uuid",
      "unit_name": "strip",
      "created_at": "2026-05-15T10:32:00.000Z",
      "updated_at": "2026-05-15T10:32:00.000Z"
    }
  ]
}
```

**Notes:**
- Results are sorted alphabetically by unit_name
- Returns empty array if no units exist

---

### 3. Get Unit by ID
Retrieve a single unit by its ID.

**Endpoint:** `GET /api/grocery/units/:id`

**Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
- `id` - Unit UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Unit retrieved successfully",
  "data": {
    "unit_id": "uuid",
    "owner_id": "uuid",
    "unit_name": "strip",
    "created_at": "2026-05-15T10:30:00.000Z",
    "updated_at": "2026-05-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `404` - Unit not found
- `403` - Unauthorized access (unit belongs to another owner)
- `500` - Server error

---

### 4. Update Unit
Update an existing unit.

**Endpoint:** `PUT /api/grocery/units/:id`

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**URL Parameters:**
- `id` - Unit UUID

**Request Body:**
```json
{
  "unit_name": "Bottle"
}
```

**Validation Rules:**
- Same as Create Unit
- New name must not conflict with existing units (except itself)

**Success Response (200):**
```json
{
  "success": true,
  "message": "Unit updated successfully",
  "data": {
    "unit_id": "uuid",
    "owner_id": "uuid",
    "unit_name": "bottle",
    "created_at": "2026-05-15T10:30:00.000Z",
    "updated_at": "2026-05-15T11:45:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Validation error
- `404` - Unit not found
- `403` - Unauthorized access
- `409` - Unit name already exists
- `500` - Server error

---

### 5. Delete Unit
Delete a unit (only if not used by any products).

**Endpoint:** `DELETE /api/grocery/units/:id`

**Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
- `id` - Unit UUID

**Success Response (200):**
```json
{
  "success": true,
  "message": "Unit deleted successfully",
  "data": {
    "message": "Unit deleted successfully"
  }
}
```

**Error Responses:**
- `404` - Unit not found
- `403` - Unauthorized access
- `409` - Cannot delete unit (used by products)
  ```json
  {
    "success": false,
    "message": "Cannot delete unit. It is being used by 5 product(s)"
  }
  ```
- `500` - Server error

---

## Common Unit Examples

### Pharmacy Units:
- `strip` - Medicine strips
- `bottle` - Syrup bottles
- `vial` - Injection vials
- `tube` - Ointment tubes
- `sachet` - Small packets
- `capsule` - Individual capsules
- `tablet` - Individual tablets

### Grocery Units:
- `kg` - Kilograms
- `gram` - Grams
- `liter` - Liters
- `ml` - Milliliters
- `piece` - Individual items
- `pack` - Packets
- `box` - Boxes
- `dozen` - 12 pieces
- `carton` - Large boxes

---

## Usage Flow

1. **Owner registers** → No units exist yet
2. **Owner creates units** → POST `/api/grocery/units` with common units
3. **Owner creates products** → References unit_id from created units
4. **Owner can add more units** → As needed for new product types
5. **Owner cannot delete units** → If they're being used by products

---

## Validation Examples

### ✅ Valid Unit Names:
- `strip`
- `bottle`
- `kg`
- `1.5 liter`
- `500ml`
- `pack/10`
- `box-large`

### ❌ Invalid Unit Names:
- `` (empty)
- `strip@pharmacy` (contains @)
- `unit#1` (contains #)
- `test_unit` (contains underscore)
- `a very long unit name that exceeds fifty characters limit` (too long)

---

## Security Features

1. **Owner-scoped:** Each owner can only access their own units
2. **Unique constraint:** Unit names are unique per owner (case-insensitive)
3. **Delete protection:** Cannot delete units that are in use
4. **Input sanitization:** Names are trimmed and lowercased
5. **Pattern validation:** Only safe characters allowed

---

## Database Schema

```prisma
model GroceryUnit {
  unit_id    String           @id @default(uuid())
  owner_id   String
  unit_name  String
  created_at DateTime         @default(now())
  updated_at DateTime         @updatedAt
  owner      Owner            @relation(...)
  products   GroceryProduct[]

  @@unique([owner_id, unit_name])
  @@index([owner_id])
  @@map("grocery_units")
}
```

---

Last Updated: May 15, 2026
