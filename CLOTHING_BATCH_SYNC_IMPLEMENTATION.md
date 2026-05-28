# Clothing Batch Sync Implementation

## Overview
The clothing module now has a complete batch sync system similar to the grocery module. This allows offline-first applications to sync multiple entities in a single API call with automatic dependency handling and idempotency.

---

## Architecture

### Sync Order (Dependency Chain)
```
1. Categories (no dependencies)
   ↓
2. Colors (no dependencies)
   ↓
3. Sizes (no dependencies)
   ↓
4. Suppliers (no dependencies)
   ↓
5. Products (depends on: categories)
   ↓
6. Stock Lots (depends on: products, suppliers, colors, sizes)
   ↓
7. Sales (depends on: products)
   ↓
8. Returns (depends on: sales)
```

### Supported Operations
- ✅ **CREATE** - Full support with idempotency
- ❌ **UPDATE** - Not supported in sync (use direct API)
- ❌ **DELETE** - Not supported in sync (use direct API)

---

## Files Created

### 1. Service Layer
**File**: `src/services/clothingBatchSyncService.js`

**Key Methods**:
- `batchSync(owner_id, payload)` - Main sync orchestrator
- `findByIdempotencyKey(owner_id, entity_type, local_id)` - Lookup existing synced records
- `saveIdempotencyKey(owner_id, entity_type, local_id, server_id, operation)` - Save sync mapping

**Features**:
- Automatic dependency resolution
- Duplicate detection and merging
- Idempotency to prevent duplicate records
- Local ID to server ID mapping
- Comprehensive error handling

### 2. Controller Layer
**File**: `src/controllers/clothingBatchSyncController.js`

**Endpoints**:
- `POST /api/clothing/sync` - Batch sync endpoint

**Validation**:
- At least one entity type required
- Proper error responses

### 3. Routes
**File**: `src/routes/clothingBatchSyncRoutes.js`

**Route**:
```javascript
POST /api/clothing/sync (auth required)
```

### 4. App Integration
**File**: `src/app.js`

**Changes**:
- Imported `clothingBatchSyncRoutes`
- Registered route: `app.use("/api/clothing/sync", clothingBatchSyncRoutes)`

---

## API Endpoint

### POST /api/clothing/sync

**Authentication**: Required (Bearer token)

**Request Body**:
```json
{
  "categories": [
    {
      "local_id": "cat-1",
      "category_name": "T-Shirts",
      "operation": "create"
    }
  ],
  "colors": [
    {
      "local_id": "color-1",
      "color_name": "Red",
      "operation": "create"
    }
  ],
  "sizes": [
    {
      "local_id": "size-1",
      "size_name": "M",
      "operation": "create"
    }
  ],
  "suppliers": [
    {
      "local_id": "supp-1",
      "supplier_name": "ABC Supplier",
      "phone": "9841234567",
      "email": "supplier@example.com",
      "address": "Kathmandu",
      "operation": "create"
    }
  ],
  "products": [
    {
      "local_id": "prod-1",
      "category_id": "cat-1",
      "product_name": "Red T-Shirt",
      "operation": "create"
    }
  ],
  "stock_lots": [
    {
      "local_id": "lot-1",
      "product_id": "prod-1",
      "supplier_id": "supp-1",
      "color_id": "color-1",
      "size_id": "size-1",
      "qty_in": 50,
      "cp": 200,
      "sp": 500,
      "notes": "Initial stock",
      "operation": "create"
    }
  ],
  "sales": [
    {
      "local_id": "sale-1",
      "customer": {
        "phone": "9841234567",
        "full_name": "John Doe",
        "email": "john@example.com",
        "address": "Kathmandu"
      },
      "paid_amount": 500,
      "payment_status": "paid",
      "note": "First sale",
      "items": [
        {
          "product_id": "prod-1",
          "lot_id": "lot-1",
          "size_id": "size-1",
          "color_id": "color-1",
          "qty": 2,
          "sp": 500,
          "note": "2 pieces"
        }
      ],
      "operation": "create"
    }
  ],
  "returns": [
    {
      "local_id": "return-1",
      "sales_id": "sale-1",
      "note": "Customer return",
      "items": [
        {
          "sales_item_id": "item-1",
          "qty": 1,
          "condition": "good",
          "note": "Changed mind"
        }
      ],
      "operation": "create"
    }
  ]
}
```

**Response (Success)**:
```json
{
  "success": true,
  "data": {
    "synced": {
      "categories": [
        {
          "local_id": "cat-1",
          "server_id": "uuid-123",
          "status": "created"
        }
      ],
      "colors": [
        {
          "local_id": "color-1",
          "server_id": "uuid-456",
          "status": "created"
        }
      ],
      "sizes": [
        {
          "local_id": "size-1",
          "server_id": "uuid-789",
          "status": "created"
        }
      ],
      "suppliers": [
        {
          "local_id": "supp-1",
          "server_id": "uuid-101",
          "status": "created"
        }
      ],
      "products": [
        {
          "local_id": "prod-1",
          "server_id": "uuid-202",
          "status": "created"
        }
      ],
      "stock_lots": [
        {
          "local_id": "lot-1",
          "server_id": "uuid-303",
          "status": "created"
        }
      ],
      "sales": [
        {
          "local_id": "sale-1",
          "server_id": "uuid-404",
          "status": "created"
        }
      ],
      "returns": [
        {
          "local_id": "return-1",
          "server_id": "uuid-505",
          "status": "created"
        }
      ]
    },
    "failed": [],
    "id_mapping": {
      "cat-1": "uuid-123",
      "color-1": "uuid-456",
      "size-1": "uuid-789",
      "supp-1": "uuid-101",
      "prod-1": "uuid-202",
      "lot-1": "uuid-303",
      "sale-1": "uuid-404",
      "return-1": "uuid-505"
    }
  }
}
```

**Response (With Errors)**:
```json
{
  "success": true,
  "data": {
    "synced": {
      "categories": [...],
      "colors": [...],
      "sizes": [...],
      "suppliers": [...],
      "products": [...],
      "stock_lots": [...],
      "sales": [...],
      "returns": [...]
    },
    "failed": [
      {
        "type": "stock_lot",
        "local_id": "lot-2",
        "operation": "create",
        "error": "Invalid product mapping: prod-999"
      }
    ],
    "id_mapping": {...}
  }
}
```

---

## Sync Statuses

### Created
- New record created on server
- Idempotency key saved for future syncs

### Already Synced
- Record already exists from previous sync
- Uses cached server ID from idempotency table

### Duplicate Merged
- Record with same data already exists
- Uses existing record instead of creating duplicate
- Idempotency key saved for future syncs

---

## Idempotency System

### How It Works
1. Client sends `local_id` for each entity
2. Server checks `SyncIdempotency` table for existing mapping
3. If found: returns cached `server_id` (status: "already_synced")
4. If not found: creates new record and saves mapping
5. Future syncs with same `local_id` return same `server_id`

### Benefits
- **Offline Support**: Clients can retry failed syncs without duplicates
- **Network Resilience**: Handles connection interruptions gracefully
- **Consistency**: Same local ID always maps to same server ID

### Database Table
```prisma
model SyncIdempotency {
  id             String   @id @default(uuid())
  owner_id       String
  entity_type    String   // "clothing_category", "clothing_color", etc.
  local_id       String   // Client-side ID
  server_id      String   // Server-side ID
  operation      String   @default("create")
  created_at     DateTime @default(now())
  last_synced_at DateTime @default(now()) @updatedAt

  @@unique([owner_id, entity_type, local_id])
  @@index([owner_id, entity_type])
  @@index([last_synced_at])
}
```

---

## Duplicate Detection

### Categories
- Checked by: `category_name` (case-insensitive)
- If duplicate found: merged instead of created

### Colors
- Checked by: `color_name` (case-insensitive)
- If duplicate found: merged instead of created

### Sizes
- Checked by: `size_name` (case-insensitive)
- If duplicate found: merged instead of created

### Suppliers
- Checked by: `owner_id`, `supplier_name`, `phone`
- If duplicate found: merged instead of created

### Products
- Checked by: `owner_id`, `product_name`, `category_id`
- If duplicate found: merged instead of created

### Stock Lots
- Checked by: `product_id`, `supplier_id`, `color_id`, `size_id`
- If duplicate found: merged instead of created

---

## Error Handling

### Validation Errors
```json
{
  "success": false,
  "error_code": "VALIDATION_NO_DATA",
  "message": "At least one entity type is required"
}
```

### Sync Errors (Partial Success)
- Individual entity errors are captured in `failed` array
- Other entities continue syncing
- Returns 200 with partial results

### Server Errors
```json
{
  "success": false,
  "error_code": "SERVER_ERROR",
  "message": "Error message"
}
```

---

## Usage Examples

### Example 1: Sync Categories Only
```bash
curl -X POST http://localhost:3000/api/clothing/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "categories": [
      {
        "local_id": "cat-1",
        "category_name": "T-Shirts"
      }
    ]
  }'
```

### Example 2: Sync Complete Workflow
```bash
curl -X POST http://localhost:3000/api/clothing/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "categories": [...],
    "colors": [...],
    "sizes": [...],
    "suppliers": [...],
    "products": [...],
    "stock_lots": [...],
    "sales": [...],
    "returns": [...]
  }'
```

### Example 3: Retry Failed Sync
```bash
# First sync (some items fail)
curl -X POST http://localhost:3000/api/clothing/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'

# Retry with same local_ids (idempotency prevents duplicates)
curl -X POST http://localhost:3000/api/clothing/sync \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'
```

---

## Comparison: Grocery vs Clothing

| Feature | Grocery | Clothing |
|---------|---------|----------|
| Categories | ✅ | ✅ |
| Brands | ✅ | ❌ |
| Units | ✅ | ❌ |
| Colors | ❌ | ✅ |
| Sizes | ❌ | ✅ |
| Suppliers | ✅ | ✅ |
| Products | ✅ | ✅ |
| Stock Lots | ✅ CREATE | ✅ CREATE |
| Sales | ✅ CREATE | ✅ CREATE |
| Returns | ✅ CREATE | ✅ CREATE |
| Idempotency | ✅ | ✅ |
| Duplicate Detection | ✅ | ✅ |

---

## Implementation Details

### Service Layer
- **clothingBatchSyncService.js**: Orchestrates sync with dependency handling
- Uses existing services: `clothingCategoryService`, `clothingColorService`, etc.
- Maintains `id_mapping` for local-to-server ID translation
- Tracks `failed` items for error reporting

### Controller Layer
- **clothingBatchSyncController.js**: Validates request and calls service
- Returns structured response with synced/failed items
- Proper error handling and HTTP status codes

### Routes
- **clothingBatchSyncRoutes.js**: Single POST endpoint
- Authentication required
- Mounted at `/api/clothing/sync`

---

## Testing Checklist

- [ ] Sync single entity type (categories)
- [ ] Sync multiple entity types
- [ ] Sync with dependencies (products → categories)
- [ ] Sync with duplicate detection
- [ ] Sync with idempotency (retry same local_ids)
- [ ] Sync with partial failures
- [ ] Verify id_mapping is correct
- [ ] Verify failed items are reported
- [ ] Test with invalid data
- [ ] Test without authentication

---

## Future Enhancements

1. **Batch Size Limits**: Add pagination for large syncs
2. **Partial Rollback**: Option to rollback on first error
3. **Sync History**: Track all sync operations
4. **Conflict Resolution**: Handle conflicting updates
5. **Compression**: Support gzip for large payloads
6. **Webhooks**: Notify client of sync completion

---

## Summary

The clothing batch sync system is now fully implemented with:
- ✅ Complete entity sync (categories, colors, sizes, suppliers, products, stock lots, sales, returns)
- ✅ Automatic dependency resolution
- ✅ Idempotency to prevent duplicates
- ✅ Duplicate detection and merging
- ✅ Comprehensive error handling
- ✅ Local-to-server ID mapping
- ✅ CREATE-only operations (no UPDATE/DELETE in sync)

The implementation mirrors the grocery module for consistency and follows the same patterns for maintainability.
