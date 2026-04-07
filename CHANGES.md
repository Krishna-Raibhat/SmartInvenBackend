# Code Changes Document

## 1. Stock Flow Report Fix

### File Changed
`src/services/clothingReportService.js`

### Method
`stockFlow()`

### Issue Fixed
Stock flow report was showing days with only stock-in (no sales) as "0 profit", making it look like a loss.

### Change
Added WHERE clause to filter out days with no stock-out activity.

```sql
WHERE (COALESCE(o.qty_out, 0) > 0 OR COALESCE(r.qty_returned, 0) > 0)
```

### Result
Only days with actual sales or returns now appear in the report.

---

## 2. Issue Report API

### New Files Created
- `src/controllers/issueReportController.js`
- `src/routes/issueReportRoutes.js`

### Files Modified
- `src/utils/mailer.js` - Added `sendIssueReport()` function
- `src/app.js` - Mounted route at `/api/issue-report`
- `.env` - Added `SUPPORT_EMAIL` variable

### API Endpoint
```
POST /api/issue-report
```

### Request Body
```json
{
  "name": "User Name",
  "email": "user@example.com",
  "subject": "Issue Subject",
  "description": "Issue description"
}
```

### Environment Variable
```
SUPPORT_EMAIL=elevatetch@gmail.com
```

### Result
Users can now submit issue reports from the app, which are sent via email to the support team.
