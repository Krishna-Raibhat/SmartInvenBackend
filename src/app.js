// src/app.js
import dotenv from "dotenv";
dotenv.config();

import express, { json, urlencoded } from "express";
import cors from "cors";
// If you don't want morgan, remove the next 2 lines
import morgan from "morgan";

import { prisma, connectDB } from "./prisma/client.js";// ✅ IMPORTANT (adapter-based Prisma client)

import authRoutes from "./routes/authRoutes.js";
import hardwareSupplierRoutes from "./routes/hardwareSupplierRoutes.js";
import hardwareCategoryRoutes from "./routes/hardwareCategoryRoutes.js";
import hardwareProductRoutes from "./routes/hardwareProductRoutes.js";
import hardwareStockInRoutes from "./routes/hardwareStockInRoutes.js";
import hardwareStockOutRoutes from "./routes/hardwareStockOutRoutes.js";
import hardwareInventoryRoutes from "./routes/hardwareInventoryRoutes.js";
import hardwareDashboardRoutes from "./routes/hardwareDashboardRoutes.js";
import hardwareProfitLossRoutes from "./routes/hardwareProfitLossRoutes.js";
import hardwareTopSelligRoutes from "./routes/hardwareTopSellingRoutes.js";
import hardwareReportRoutes from "./routes/hardwareReportRoutes.js";
import stockOutCreditRoutes from "./routes/stockOutCreditRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import issueReportRoutes from "./routes/issueReportRoutes.js";

import clothingSupplierRoutes from "./routes/clothingSupplierRoutes.js";
import clothingCategoryRoutes from "./routes/clothingCategoryRoutes.js";
import clothingSizeRoutes from "./routes/clothingSizeRoutes.js";
import clothingColorRoutes from "./routes/clothingColorRoutes.js";
import clothingProductRoutes from "./routes/clothingProductRoutes.js";
import clothingStockLotRoutes from "./routes/clothingStockLotRoutes.js";
import clothingSalesRoutes from "./routes/clothingSalesRoutes.js";
import clothingCustomerReturnRoutes from "./routes/clothingCustomerReturnRoutes.js";
import clothingSupplierReturnRoutes from "./routes/clothingSupplierReturnRoutes.js";



import clothingLowStockRoutes from "./routes/clothingLowStockRoutes.js";
import clothingNotificationRoutes from "./routes/clothingNotificationRoutes.js";
import clothingReportRoutes from "./routes/clothingReportRoutes.js";
import clothingDashboardRoutes from "./routes/clothingDashboardRoutes.js";
import clothingInventoryRoutes from "./routes/clothingInventoryRoutes.js";
import clothingActivityRoutes from "./routes/clothingActivityRoutes.js";
import paymentQRStoreRoutes from "./routes/paymentQRStoreRoutes.js";
import paymentProofRoutes from "./routes/paymentProofRoutes.js";
import packageRoutes from "./routes/packageRoutes.js";
import adminDashboardRoutes from "./routes/adminDashboardRoutes.js";
import grocerySupplierRoutes from "./routes/grocerySupplierRoutes.js";
import groceryCategoryRoutes from "./routes/groceryCategoryRoutes.js";
import groceryBrandRoutes from "./routes/groceryBrandRoutes.js";
import groceryUnitRoutes from "./routes/groceryUnitRoutes.js";
import groceryProductRoutes from "./routes/groceryProductRoutes.js";
import groceryStockLotRoutes from "./routes/groceryStockLotRoutes.js";
import grocerySupplierReturnRoutes from "./routes/grocerySupplierReturnRoutes.js";
import grocerySalesRoutes from "./routes/grocerySalesRoutes.js";
import groceryCustomerReturnRoutes from "./routes/groceryCustomerReturnRoutes.js";


const app = express();

// Middlewares
app.use(cors());
app.use(json({ limit: "2mb" }));
app.use(urlencoded({ extended: true }));

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
app.use("/api/issue-report", issueReportRoutes);

import "./cron/lowStockCronAll.js";
import "./cron/subscriptionReminderCron.js";
import "./cron/subscriptionExpiryCron.js";



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
app.use("/api/clothing/low-stock", clothingLowStockRoutes);
app.use("/api/clothing/notifications", clothingNotificationRoutes);
app.use("/api/clothing/reports", clothingReportRoutes);
app.use("/api/clothing/dashboard", clothingDashboardRoutes);
app.use("/api/clothing/inventory", clothingInventoryRoutes);
app.use("/api/clothing/activities", clothingActivityRoutes);
app.use("/api/payment-qr", paymentQRStoreRoutes);
app.use("/api/payment-proof", paymentProofRoutes);
app.use("/api/packages", packageRoutes);
app.use("/api/admin/dashboard", adminDashboardRoutes);

// Grocery routes
app.use("/api/grocery/suppliers", grocerySupplierRoutes);
app.use("/api/grocery/categories", groceryCategoryRoutes);
app.use("/api/grocery/brands", groceryBrandRoutes);
app.use("/api/grocery/units", groceryUnitRoutes);
app.use("/api/grocery/products", groceryProductRoutes);
app.use("/api/grocery/stock-lots", groceryStockLotRoutes);
app.use("/api/grocery/supplier-returns", grocerySupplierReturnRoutes);
app.use("/api/grocery/sales", grocerySalesRoutes);
app.use("/api/grocery/returns/customer", groceryCustomerReturnRoutes);

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
