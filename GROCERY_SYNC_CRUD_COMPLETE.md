# Grocery Batch Sync - Full CRUD Implementation

## Overview
Complete bidirectional sync system supporting CREATE, UPDATE, DELETE, and READ operations for grocery module with offline support and conflict resolution.

## Database Changes

### Schema Updates
All grocery tables now include:
- `updated_at` - Auto-updated timestamp for tracking changes
- `deleted_at` - Soft delete timestamp (NULL = active, timestamp = deleted)

### Tables Modified
- `grocery_categories`
- `grocery_brands`
- `grocery_units`
- `grocery_suppliers`
- `grocery_products`
- `grocery_stock_lots`
- `grocery_sales`
- `grocery_customer_returns`

### SyncIdempotency Table Enhanced
```prisma
model SyncIdempotency {
  id             String   @id @default(uuid())
  owner_id       String
  entity_type    String
  local_id       String
  server_id      String
  operation      String   @default("create")  // NEW: track operation type
  created_at     DateTime @default(now())
  last_synced_at DateTime @default(now()) @updatedAt  // NEW: track sync time
}
```

## API Endpoints

### 1. Push Sync (Mobile → Server)
**POST** `/api/grocery/sync/batch`

Supports CREATE, UPDATE, DELETE operations in a single request.

#### Request Format
```json
{
  "categories": [
    {
      "operation": "create",
      "local_id": "cat_1",
      "category_name": "Beverages"
    },
    {
      "operation": "update",
      "local_id": "cat_2",
      "server_id": 123,
      "category_name": "Updated Beverages"
    },
    {
      "operation": "delete",
      "local_id": "cat_3",
      "server_id": 456
    }
  ],
  "brands": [...],
  "units": [...],
  "suppliers": [...],
  "products": [...],
  "stock_lots": [...],
  "sales": [...],
  "returns": [...]
}
```

#### Response
```json
{
  "success": true,
  "message": "Batch sync completed",
  "data": {
    "synced": {
      "categories": [
        {
          "local_id": "cat_1",
          "server_id": "uuid-123",
          "status": "created"
        },
        {
          "local_id": "cat_2",
          "server_id": 123,
          "status": "updated"
        },
        {
          "local_id": "cat_3",
          "server_id": 456,
          "status": "deleted"
        }
      ],
      "brands": [...],
      "units": [...],
      "suppliers": [...],
      "products": [...],
      "stock_lots": [...],
      "sales": [...],
      "returns": [...]
    },
    "failed": [
      {
        "type": "product",
        "local_id": "prod_5",
        "operation": "update",
        "error": "Product not found"
      }
    ],
    "id_mapping": {
      "cat_1": "uuid-123",
      "cat_2": 123,
      "prod_1": "uuid-456"
    }
  }
}
```

### 2. Pull Sync (Server → Mobile)
**GET** `/api/grocery/sync/pull?since=2024-05-24T10:00:00Z`

Downloads all changes since last sync timestamp.

#### Response
```json
{
  "success": true,
  "message": "Pull sync completed",
  "data": {
    "categories": {
      "created": [
        {
          "category_id": "uuid-1",
          "category_name": "New Category",
          "created_at": "2024-05-24T11:00:00Z"
        }
      ],
      "updated": [
        {
          "category_id": "uuid-2",
          "category_name": "Updated Category",
          "updated_at": "2024-05-24T11:30:00Z"
        }
      ],
      "deleted": [
        {
          "id": "uuid-3",
          "deleted_at": "2024-05-24T12:00:00Z"
        }
      ]
    },
    "brands": {...},
    "units": {...},
    "suppliers": {...},
    "products": {...},
    "stock_lots": {...},
    "sales": {...},
    "returns": {...},
    "last_sync_timestamp": "2024-05-24T12:30:00Z"
  }
}
```

### 3. Check Sync Status
**POST** `/api/grocery/sync/status`

Check which records are already synced.

#### Request
```json
{
  "items": [
    { "entity_type": "category", "local_id": "cat_1" },
    { "entity_type": "product", "local_id": "prod_1" },
    { "entity_type": "sale", "local_id": "sale_1" }
  ]
}
```

#### Response
```json
{
  "success": true,
  "data": [
    {
      "entity_type": "category",
      "local_id": "cat_1",
      "is_synced": true,
      "server_id": "uuid-123",
      "synced_at": "2024-05-24T10:00:00Z"
    },
    {
      "entity_type": "product",
      "local_id": "prod_1",
      "is_synced": false,
      "server_id": null,
      "synced_at": null
    }
  ]
}
```

## Operation Types

### CREATE
- Creates new record on server
- Returns server_id for future reference
- Checks for duplicates by name/unique fields
- Stores idempotency key to prevent re-creation

### UPDATE
- Updates existing record on server
- Requires either `server_id` or `local_id` (looks up via idempotency)
- Updates `updated_at` timestamp automatically
- Tracks operation in idempotency table

### DELETE
- Soft deletes record (sets `deleted_at` timestamp)
- Record remains in database for audit trail
- Mobile can detect deletion via pull sync
- Can be restored by clearing `deleted_at`

## Sync Flow

### Push Sync (Mobile → Server)
```
1. Mobile collects local changes (create/update/delete)
2. Mobile sends batch to POST /api/grocery/sync/batch
3. Server processes in dependency order:
   - Categories, Brands, Units, Suppliers (no deps)
   - Products (depends on category, brand, unit)
   - Stock Lots (depends on product, supplier)
   - Sales (depends on product)
   - Returns (depends on sale)
4. Server returns id_mapping for local_id → server_id
5. Mobile stores mapping for future syncs
```

### Pull Sync (Server → Mobile)
```
1. Mobile requests GET /api/grocery/sync/pull?since=last_sync_time
2. Server queries all changes since timestamp:
   - created: WHERE created_at >= since AND deleted_at IS NULL
   - updated: WHERE updated_at >= since AND created_at < since AND deleted_at IS NULL
   - deleted: WHERE deleted_at >= since
3. Server returns all changes grouped by entity type
4. Mobile applies changes:
   - Merge created/updated records
   - Delete records in deleted list
5. Mobile stores new last_sync_timestamp
```

## Conflict Resolution

### Strategy: Server Wins (Timestamp-based)
When same record edited on mobile and server:
```javascript
if (serverRecord.updated_at > mobileRecord.updated_at) {
  // Use server data
  applyServerChanges();
} else {
  // Use mobile data
  applyMobileChanges();
}
```

### Soft Deletes Prevent Conflicts
- Deleted records stay in DB with `deleted_at` timestamp
- Mobile can see deletion and remove locally
- No data loss, full audit trail maintained

## Idempotency

### Why It Matters
Prevents duplicate records if sync fails and retries:
```
Scenario: Mobile sends product, network fails
- First attempt: Creates product, stores idempotency key
- Retry: Finds idempotency key, returns existing server_id
- Result: No duplicate created ✅
```

### How It Works
```javascript
// Check if already synced
const existing = await findByIdempotencyKey(owner_id, 'product', local_id);
if (existing) {
  return { status: 'already_synced', server_id: existing.product_id };
}

// Create new and store key
const created = await createProduct(...);
await saveIdempotencyKey(owner_id, 'product', local_id, created.product_id, 'create');
```

## Offline Support

### Mobile Workflow
```
1. User works offline, creates/edits/deletes records locally
2. All operations stored with local_id and operation type
3. When online, mobile calls POST /api/grocery/sync/batch
4. Server processes all changes atomically
5. Mobile receives id_mapping and updates local DB
6. Next sync uses server_id instead of local_id
```

### Data Consistency
- Soft deletes ensure no data loss
- Idempotency prevents duplicates
- Timestamps enable conflict resolution
- Dependency ordering prevents foreign key errors

## Example: Complete Sync Cycle

### Step 1: Mobile Creates Data Offline
```javascript
// Local DB
categories: [
  { local_id: 'cat_1', name: 'Beverages', operation: 'create' }
]
products: [
  { local_id: 'prod_1', name: 'Coke', category_id: 'cat_1', operation: 'create' }
]
```

### Step 2: Mobile Goes Online, Pushes Changes
```javascript
POST /api/grocery/sync/batch
{
  categories: [
    { operation: 'create', local_id: 'cat_1', category_name: 'Beverages' }
  ],
  products: [
    { operation: 'create', local_id: 'prod_1', category_id: 'cat_1', product_name: 'Coke', unit_id: 'unit_1' }
  ]
}
```

### Step 3: Server Processes & Returns Mapping
```javascript
{
  synced: {
    categories: [{ local_id: 'cat_1', server_id: 'uuid-123', status: 'created' }],
    products: [{ local_id: 'prod_1', server_id: 'uuid-456', status: 'created' }]
  },
  id_mapping: {
    'cat_1': 'uuid-123',
    'prod_1': 'uuid-456'
  }
}
```

### Step 4: Mobile Updates Local DB
```javascript
// Update local records with server IDs
categories: [
  { local_id: 'cat_1', server_id: 'uuid-123', name: 'Beverages', synced: true }
]
products: [
  { local_id: 'prod_1', server_id: 'uuid-456', name: 'Coke', category_id: 'uuid-123', synced: true }
]
```

### Step 5: Mobile Pulls Latest Changes
```javascript
GET /api/grocery/sync/pull?since=2024-05-24T10:00:00Z
```

### Step 6: Mobile Merges Server Changes
```javascript
// Apply created/updated records
// Delete records in deleted list
// Store new last_sync_timestamp
```

## Error Handling

### Partial Failures
If some records fail, others still sync:
```json
{
  "synced": {
    "categories": [{ status: "created" }],
    "products": [{ status: "created" }]
  },
  "failed": [
    {
      "type": "sale",
      "local_id": "sale_1",
      "operation": "update",
      "error": "Sale not found"
    }
  ]
}
```

### Retry Strategy
- Mobile retries failed records in next sync
- Idempotency prevents duplicates on retry
- Server logs all operations for debugging

## Performance Considerations

### Indexes Added
- `deleted_at` - Filter active records
- `updated_at` - Find changed records
- `last_synced_at` - Track sync progress

### Query Optimization
- Pull sync uses timestamp ranges
- Soft deletes avoid expensive hard deletes
- Batch operations reduce round trips

## Migration Path

### From Create-Only to Full CRUD
1. ✅ Database migration applied (adds deleted_at, updated_at)
2. ✅ Service methods enhanced (handleUpdate, handleDelete)
3. ✅ API endpoints updated (batch sync supports operations)
4. ✅ Pull endpoint added (GET /api/grocery/sync/pull)
5. Mobile app updates to send operation type in requests

## Testing Checklist

- [ ] Create operation works
- [ ] Update operation works
- [ ] Delete operation works (soft delete)
- [ ] Pull sync returns created/updated/deleted
- [ ] Idempotency prevents duplicates
- [ ] Conflict resolution uses timestamps
- [ ] Offline sync works end-to-end
- [ ] Partial failures handled correctly
- [ ] Dependency ordering maintained
- [ ] ID mapping returned correctly

## Future Enhancements

1. **Conflict Resolution UI** - Show conflicts to user for manual resolution
2. **Compression** - Gzip large sync payloads
3. **Pagination** - Handle large datasets in pull sync
4. **Selective Sync** - Sync only specific entity types
5. **Bandwidth Optimization** - Delta sync (only changed fields)
6. **Encryption** - Encrypt sensitive data in transit
