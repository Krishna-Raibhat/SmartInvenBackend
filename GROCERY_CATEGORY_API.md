# Grocery Category API Documentation

## Overview
Complete CRUD operations for grocery categories, matching the exact pattern of clothing categories.

## Base URL
```
/api/grocery/categories
```

## Authentication
All endpoints require authentication via JWT token in the `Authorization` header:
```
Authorization: Bearer <token>
```

---

## Endpoints

### 1. Create Category
**POST** `/api/grocery/categories`

Creates a new grocery category.

**Request Body:**
```json
{
  "category_name": "Vegetables"
}
```

**Required Fields:**
- `category_name` (string)

**Validation:**
- Category name is trimmed and converted to lowercase
- Category name must be unique (case-insensitive)

**Success Response (201):**
```json
{
  "success": true,
  "data": {
    "category_id": "uuid",
    "category_name": "vegetables",
    "created_at": "2026-05-10T10:30:00.000Z",
    "updated_at": "2026-05-10T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `400 VALIDATION_REQUIRED_FIELDS` - Missing category_name
- `409 CATEGORY_ALREADY_EXISTS` - Category name already exists

---

### 2. List All Categories
**GET** `/api/grocery/categories`

Retrieves all grocery categories.

**Success Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "category_id": "uuid",
      "category_name": "vegetables",
      "created_at": "2026-05-10T10:30:00.000Z",
      "updated_at": "2026-05-10T10:30:00.000Z"
    },
    {
      "category_id": "uuid",
      "category_name": "fruits",
      "created_at": "2026-05-09T10:30:00.000Z",
      "updated_at": "2026-05-09T10:30:00.000Z"
    }
  ]
}
```

**Notes:**
- Results are ordered by `created_at` descending (newest first)
- Categories are global (not owner-scoped)

---

### 3. Get Category by ID
**GET** `/api/grocery/categories/:category_id`

Retrieves a specific grocery category by ID.

**URL Parameters:**
- `category_id` (uuid) - The category's unique identifier

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "category_id": "uuid",
    "category_name": "vegetables",
    "created_at": "2026-05-10T10:30:00.000Z",
    "updated_at": "2026-05-10T10:30:00.000Z"
  }
}
```

**Error Responses:**
- `404 NOT_FOUND` - Category not found

---

### 4. Update Category
**PUT** `/api/grocery/categories/:category_id`

Updates an existing grocery category.

**URL Parameters:**
- `category_id` (uuid) - The category's unique identifier

**Request Body:**
```json
{
  "category_name": "Fresh Vegetables"
}
```

**Required Fields:**
- `category_name` (string)

**Validation:**
- Category name is trimmed and converted to lowercase
- Category name must be unique (case-insensitive)

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "category_id": "uuid",
    "category_name": "fresh vegetables",
    "created_at": "2026-05-10T10:30:00.000Z",
    "updated_at": "2026-05-10T11:00:00.000Z"
  }
}
```

**Error Responses:**
- `400 VALIDATION_REQUIRED_FIELDS` - Missing category_name
- `404 NOT_FOUND` - Category not found
- `409 CATEGORY_ALREADY_EXISTS` - Category name already exists

---

### 5. Delete Category
**DELETE** `/api/grocery/categories/:category_id`

Deletes a grocery category.

**URL Parameters:**
- `category_id` (uuid) - The category's unique identifier

**Success Response (200):**
```json
{
  "success": true,
  "message": "Category deleted successfully"
}
```

**Error Responses:**
- `404 NOT_FOUND` - Category not found
- `409 DELETE_BLOCKED` - Cannot delete category linked to products (when GroceryProduct is implemented)

**Notes:**
- Currently allows deletion without checking products
- Will be updated to block deletion when GroceryProduct model is created

---

## Validation Rules

### Category Name
- Required field
- Automatically trimmed of whitespace
- Automatically converted to lowercase
- Must be unique across all categories
- Examples: "Vegetables" → "vegetables", "Fresh Fruits" → "fresh fruits"

---

## Database Schema

```prisma
model GroceryCategory {
  category_id   String @id @default(uuid())
  category_name String @unique

  # Will be added when GroceryProduct is created:
  # products GroceryProduct[]

  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  @@map("grocery_categories")
}
```

---

## Key Differences from Suppliers

### Global vs Owner-Scoped
- **Categories:** Global (shared across all owners)
- **Suppliers:** Owner-scoped (each owner has their own suppliers)

### Uniqueness
- **Categories:** Unique globally by name
- **Suppliers:** Unique by phone per owner

### No Owner ID
- Categories don't have an `owner_id` field
- All authenticated users can see all categories
- This matches the clothing category pattern exactly

---

## Testing Examples

### Create Category
```bash
curl -X POST http://localhost:3000/api/grocery/categories \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category_name": "Vegetables"
  }'
```

### List Categories
```bash
curl -X GET http://localhost:3000/api/grocery/categories \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Get Category by ID
```bash
curl -X GET http://localhost:3000/api/grocery/categories/CATEGORY_UUID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Category
```bash
curl -X PUT http://localhost:3000/api/grocery/categories/CATEGORY_UUID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category_name": "Fresh Vegetables"
  }'
```

### Delete Category
```bash
curl -X DELETE http://localhost:3000/api/grocery/categories/CATEGORY_UUID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Implementation Files

- **Service:** `src/services/groceryCategoryService.js`
- **Controller:** `src/controllers/groceryCategoryController.js`
- **Routes:** `src/routes/groceryCategoryRoutes.js`
- **Schema:** `prisma/schema.prisma` (GroceryCategory model)

---

## Comparison with Clothing Categories

The grocery category implementation is **EXACTLY** the same as clothing categories:

| Feature | Clothing | Grocery |
|---------|----------|---------|
| Global scope | ✅ | ✅ |
| Lowercase conversion | ✅ | ✅ |
| Unique constraint | ✅ | ✅ |
| Product relation | ✅ | 🔜 (pending) |
| Delete protection | ✅ | 🔜 (pending) |
| Route pattern | ✅ | ✅ |
| Validation | ✅ | ✅ |

---

## Common Category Examples

```json
[
  { "category_name": "vegetables" },
  { "category_name": "fruits" },
  { "category_name": "dairy products" },
  { "category_name": "meat & poultry" },
  { "category_name": "grains & cereals" },
  { "category_name": "beverages" },
  { "category_name": "snacks" },
  { "category_name": "spices & condiments" },
  { "category_name": "bakery items" },
  { "category_name": "frozen foods" }
]
```

---

## Future Enhancements

When implementing GroceryProduct:

1. Add `products` relation to GroceryCategory model
2. Uncomment product count check in `remove()` service method
3. Update schema and regenerate Prisma client
4. Test delete protection with linked products
