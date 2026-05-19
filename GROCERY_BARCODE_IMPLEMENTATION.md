# Grocery Barcode Implementation

## Status: ⚠️ PENDING DATABASE MIGRATION

The code changes are complete, but the database schema needs to be updated.

---

## ✅ Completed Changes

### 1. Schema Updated (`prisma/schema.prisma`)
Added barcode fields to `GroceryStockLot` model:
```prisma
model GroceryStockLot {
  // ... existing fields ...
  barcode           String?   @unique
  barcode_image_url String?
  // ... rest of fields ...
}
```

### 2. Service Updated (`src/services/groceryStockLotService.js`)
- Added imports:
  - `generateAndUploadBarcode` from `../utils/barcode.js`
  - `v4 as uuidv4` from `uuid`
- Updated `create()` method to:
  - Generate unique lot_id using uuid
  - Generate barcode value and image
  - Upload barcode image to S3
  - Store both barcode value and S3 URL in database

### 3. Prisma Client Generated
- Ran `npx prisma generate` successfully
- Client is ready with new barcode fields

---

## ⚠️ REQUIRED: Database Migration

**You MUST run this command when database is accessible:**

```bash
npx prisma db push
```

This will add the following columns to `grocery_stock_lots` table:
- `barcode` (VARCHAR, UNIQUE, NULLABLE)
- `barcode_image_url` (VARCHAR, NULLABLE)

---

## 🔄 How It Works

### When Creating a Stock Lot:

1. **Generate UUID**: `lot_id = uuidv4()`
   - Example: `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`

2. **Generate Barcode**: `generateAndUploadBarcode(lot_id)`
   - Creates barcode value: `"LOT-L5K2M3N-AB4C"`
   - Renders Code128 barcode image (PNG)
   - Uploads to S3: `barcodes/{lot_id}.png`
   - Returns: `{ barcode, barcode_image_url }`

3. **Store in Database**:
   ```javascript
   {
     lot_id: "a1b2c3d4-...",
     barcode: "LOT-L5K2M3N-AB4C",
     barcode_image_url: "barcodes/a1b2c3d4-....png",
     // ... other fields
   }
   ```

4. **Access Barcode Image**:
   - S3 URL: `https://s3-np1.datahub.com.np/{BUCKET}/barcodes/{lot_id}.png`
   - Built using: `getS3Url(barcode_image_url)`

---

## 📊 Barcode Format

### Barcode Value
- **Format**: `LOT-{timestamp_base36}-{random}`
- **Example**: `LOT-L5K2M3N-AB4C`
- **Unique**: Yes (timestamp + random ensures uniqueness)
- **Database**: Stored in `barcode` column with UNIQUE constraint

### Barcode Image
- **Type**: Code128 barcode
- **Format**: PNG image
- **Scale**: 3x
- **Height**: 10 units
- **Text**: Included below barcode
- **Storage**: AWS S3 (MinIO)
- **Path**: `barcodes/{lot_id}.png`

---

## 🗄️ Storage Details

### Database (PostgreSQL)
- **Table**: `grocery_stock_lots`
- **Columns**:
  - `barcode`: VARCHAR (unique barcode value)
  - `barcode_image_url`: VARCHAR (S3 key/path)

### S3 (MinIO)
- **Bucket**: From `process.env.AWS_S3_BUCKET`
- **Endpoint**: `s3-np1.datahub.com.np`
- **Path**: `barcodes/{lot_id}.png`
- **Content-Type**: `image/png`
- **Access**: Public read (via URL)

---

## 🔧 Environment Variables Required

Ensure these are set in `.env`:
```env
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=your_bucket_name
```

---

## 📝 API Response Example

After migration, creating a stock lot will return:

```json
{
  "success": true,
  "data": {
    "product": { ... },
    "supplier": { ... },
    "lot": {
      "lot_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "owner_id": "...",
      "product_id": "...",
      "supplier_id": "...",
      "qty_in": 100.0,
      "qty_remaining": 100.0,
      "cp": 50.00,
      "sp": 75.00,
      "batch_no": "BATCH-001",
      "expiry_date": "2025-12-31T00:00:00.000Z",
      "barcode": "LOT-L5K2M3N-AB4C",
      "barcode_image_url": "barcodes/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png",
      "created_at": "2026-05-18T12:00:00.000Z",
      "product": { ... },
      "supplier": { ... }
    }
  }
}
```

---

## 🎯 Frontend Usage

### Display Barcode Image
```javascript
const barcodeUrl = `https://s3-np1.datahub.com.np/${BUCKET}/${lot.barcode_image_url}`;

<img src={barcodeUrl} alt={`Barcode ${lot.barcode}`} />
```

### Scan Barcode
- Use barcode scanner to read the barcode
- Search for stock lot by `barcode` value
- Retrieve lot details for sales/inventory operations

---

## 🔍 Querying by Barcode

After migration, you can query stock lots by barcode:

```javascript
const lot = await prisma.groceryStockLot.findUnique({
  where: { barcode: "LOT-L5K2M3N-AB4C" },
  include: {
    product: true,
    supplier: true,
  },
});
```

---

## ⚡ Next Steps

1. **Connect to Database**: Ensure database is accessible
2. **Run Migration**: `npx prisma db push`
3. **Verify Schema**: Check that columns were added
4. **Test Creation**: Create a new stock lot
5. **Verify S3 Upload**: Check that barcode image is in S3
6. **Test Retrieval**: Fetch stock lot and verify barcode fields

---

## 🐛 Troubleshooting

### Error: "Column does not exist"
- **Cause**: Database migration not run
- **Fix**: Run `npx prisma db push`

### Error: "S3 upload failed"
- **Cause**: Invalid S3 credentials or bucket
- **Fix**: Check `.env` variables

### Error: "Barcode already exists"
- **Cause**: Duplicate barcode (very rare)
- **Fix**: Retry - new timestamp will generate different barcode

---

## 📚 Related Files

- **Schema**: `prisma/schema.prisma`
- **Service**: `src/services/groceryStockLotService.js`
- **Barcode Utility**: `src/utils/barcode.js`
- **S3 Utility**: `src/utils/s3.js`
- **Controller**: `src/controllers/groceryStockLotController.js`
- **Routes**: `src/routes/groceryStockLotRoutes.js`

---

## ✅ Same as Clothing Module

This implementation follows the exact same pattern as the clothing module:
- Same barcode generation logic
- Same S3 upload process
- Same database structure
- Same API response format

The only difference is the table name: `grocery_stock_lots` vs `clothing_stock_lots`
