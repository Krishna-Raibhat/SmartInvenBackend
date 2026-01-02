// src/app.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
// If you don't want morgan, remove the next 2 lines
const morgan = require("morgan");

const { prisma, connectDB }  = require("./prisma/client"); // ✅ IMPORTANT (adapter-based Prisma client)

const authRoutes = require("./routes/authRoutes");
const hardwareSupplierRoutes = require("./routes/hardwareSupplierRoutes");
const hardwareCategoryRoutes = require("./routes/hardwareCategoryRoutes");
const hardwareProductRoutes = require("./routes/hardwareProductRoutes");
const hardwareStockInRoutes = require("./routes/hardwareStockInRoutes");
const hardwareStockOutRoutes = require("./routes/hardwareStockOutRoutes");
const hardwareInventoryRoutes = require("./routes/hardwareInventoryRoutes");
const hardwareDashboardRoutes = require("./routes/hardwareDashboardRoutes");
const hardwareProfitLossRoutes = require("./routes/hardwareProfitLossRoutes");
const hardwareTopSelligRoutes = require("./routes/hardwareTopSellingRoutes");
const hardwareReportRoutes = require("./routes/hardwareReportRoutes");
const stockOutCreditRoutes = require("./routes/stockOutCreditRoutes");
const notificationRoutes = require("./routes/notificationRoutes");

const clothingSupplierRoutes = require("./routes/clothingSupplierRoutes");
const clothingCategoryRoutes = require("./routes/clothingCategoryRoutes");const clothingSizeRoutes = require("./routes/clothingSizeRoutes");
const clothingColorRoutes = require("./routes/clothingColorRoutes");
const clothingProductRoutes = require("./routes/clothingProductRoutes");
const clothingStockLotRoutes = require("./routes/clothingStockLotRoutes");
const clothingSalesRoutes = require("./routes/clothingSalesRoutes");
const clothingCustomerReturnRoutes = require("./routes/clothingCustomerReturnRoutes");
const clothingSupplierReturnRoutes = require("./routes/clothingSupplierReturnRoutes");

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ✅ Use morgan only if installed
app.use(morgan("dev"));

// Health
app.get("/", (_req, res) => {
  res.json({ success: true, message: "Backend is running (Prisma)!" });
});

// Mount APIs
app.use("/api/auth", authRoutes);

app.use("/api/hardware/suppliers", hardwareSupplierRoutes);
app.use("/api/hardware/categories", hardwareCategoryRoutes);
app.use("/api/hardware/products", hardwareProductRoutes);

app.use("/api/hardware/stock-in", hardwareStockInRoutes);
app.use("/api/hardware/stock-out", hardwareStockOutRoutes);

app.use("/api/hardware/inventory", hardwareInventoryRoutes);
app.use("/api/hardware/dashboard", hardwareDashboardRoutes);

app.use("/api/hardware/reports", hardwareReportRoutes);
app.use("/api/stock-out", stockOutCreditRoutes);

app.use("/api/hardware/profit-loss", hardwareProfitLossRoutes);
app.use("/api/hardware/top-selling-products", hardwareTopSelligRoutes);

app.use("/api/notifications", notificationRoutes);

require("./cron/lowStockCron");
// 404

app.use("/api/clothing/suppliers", clothingSupplierRoutes);
app.use("/api/clothing/categories", clothingCategoryRoutes);
app.use("/api/clothing/sizes", clothingSizeRoutes);
app.use("/api/clothing/colors", clothingColorRoutes);
app.use("/api/clothing/products", clothingProductRoutes);
app.use("/api/clothing/stock-lots", clothingStockLotRoutes);
app.use("/api/clothing/sales", clothingSalesRoutes);
app.use("/api/clothing/returns/customer", clothingCustomerReturnRoutes);
app.use("/api/clothing/returns/supplier", clothingSupplierReturnRoutes);
app.use("/api/clothing/low-stock", require("./routes/clothingLowStockRoutes"));

app.use("/api/clothing/notifications", require("./routes/clothingNotificationRoutes"));
app.use("/api/clothing/reports", require("./routes/clothingReportRoutes"));
app.use("/api/clothing/dashboard", require("./routes/clothingDashboardRoutes"));
app.use("/api/clothing/inventory", require("./routes/clothingInventoryRoutes"));

/* ==========================
   SERVER START
========================== */

app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await connectDB(); // 🔥 if this fails → app WILL NOT start

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Unable to start server");
    console.error(err.message || err);
    process.exit(1);
  }
})();

/* ==========================
   GRACEFUL SHUTDOWN
========================== */
async function shutdown(signal) {
  console.log(`\n${signal} received. Closing server...`);
  try {
    await prisma.$disconnect();
    console.log("✅ Prisma disconnected");
  } catch (err) {
    console.error("Error during Prisma disconnect:", err);
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);