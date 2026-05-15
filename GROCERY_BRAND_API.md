# Grocery Brand API Documentation

## Overview
Complete CRUD operations for grocery brands, matching the exact pattern of grocery categories.

## Base URL
```
/api/grocery/brands
```

## Authentication
All endpoints require authentication via JWT token.

---

## Endpoints

### 1. Create Brand
**POST** `/api/grocery/brands`

**Request Body:**
```json
{
  "brand_name": "Coca Cola"
}
```

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "brand_id": "uuid",
    "brand_name": "coca cola",
    "created_at": "2026-05-15T10:30:00.000Z",
    "updated_at": "2026-05-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400 VALIDATION_REQUIRED_FIELDS` - Missing brand_name
- `409 BRAND_ALREADY_EXISTS` - Brand name already exists

---

### 2. List All Brands
**GET** `/api/grocery/brands`

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "brand_id": "uuid",
      "brand_name": "coca cola",
      "created_at": "2026-05-15T10:30:00.000Z",
      "updated_at": "2026-05-15T10:30:00.000Z"
    }
  ]
}
```

---

### 3. Get Brand by ID
**GET** `/api/grocery/brands/:brand_id`

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "brand_id": "uuid",
    "brand_name": "coca cola",
    "created_at": "2026-05-15T10:30:00.000Z",
    "updated_at": "2026-05-15T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `404 NOT_FOUND` - Brand not found

---

### 4. Update Brand
**PUT** `/api/grocery/brands/:brand_id`

**Request Body:**
```json
{
  "brand_name": "Pepsi"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "brand_id": "uuid",
    "brand_name": "pepsi",
    "created_at": "2026-05-15T10:30:00.000Z",
    "updated_at": "2026-05-15T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 VALIDATION_REQUIRED_FIELDS` - Missing brand_name
- `404 NOT_FOUND` - Brand not found
- `409 BRAND_ALREADY_EXISTS` - Brand name already exists

---

### 5. Delete Brand
**DELETE** `/api/grocery/brands/:brand_id`

**Success Response (200):**
```json
{
  "success": true,
  "message": "Brand deleted successfully"
}
```

**Error Responses:**
- `404 NOT_FOUND` - Brand not found
- `409 DELETE_BLOCKED` - Cannot delete brand linked to products

---

## Validation Rules

### Brand Name
- Required field
- Automatically trimmed of whitespace
- Automatically converted to lowercase
- Must be unique across all brands
- Examples: "Coca Cola" → "coca cola", "Pepsi Co" → "pepsi co"

---

## Database Schema

```prisma
model GroceryBrand {
  brand_id   String   @id @default(uuid())
  brand_name String   @unique
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@map("grocery_brands")
}
```

---

## Common Brand Examples

```json
[
  { "brand_name": "coca cola" },
  { "brand_name": "pepsi" },
  { "brand_name": "nestle" },
  { "brand_name": "unilever" },
  { "brand_name": "parle" },
  { "brand_name": "britannia" },
  { "brand_name": "amul" },
  { "brand_name": "dabur" },
  { "brand_name": "himalaya" },
  { "brand_name": "patanjali" }
]
```

---

## Testing Examples

### Create Brand
```bash
curl -X POST http://localhost:3000/api/grocery/brands \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"brand_name": "Coca Cola"}'
```

### List Brands
```bash
curl -X GET http://localhost:3000/api/grocery/brands \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Brand by ID
```bash
curl -X GET http://localhost:3000/api/grocery/brands/BRAND_UUID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Brand
```bash
curl -X PUT http://localhost:3000/api/grocery/brands/BRAND_UUID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"brand_name": "Pepsi"}'
```

### Delete Brand
```bash
curl -X DELETE http://localhost:3000/api/grocery/brands/BRAND_UUID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Implementation Files

- **Service:** `src/services/groceryBrandService.js`
- **Controller:** `src/controllers/groceryBrandController.js`
- **Routes:** `src/routes/groceryBrandRoutes.js`
- **Schema:** `prisma/schema.prisma` (GroceryBrand model)
- **Database Table:** `grocery_brands`

---

## Pattern Consistency

The brand implementation follows the **exact same pattern** as categories:

| Feature | Category | Brand |
|---------|----------|-------|
| Global scope | ✅ | ✅ |
| Lowercase conversion | ✅ | ✅ |
| Unique constraint | ✅ | ✅ |
| Delete protection | ✅ | ✅ |
| Route pattern | ✅ | ✅ |
| Validation | ✅ | ✅ |

---

## ✅ Ready to Use

The grocery brand CRUD is fully functional and ready for testing!

**Next Steps:**
- Test all endpoints with Postman
- Add sample brands for your grocery/pharmacy
- Ready to create GroceryProduct model with brand relation
