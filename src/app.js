// src/app.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
// If you don't want morgan, remove the next 2 lines
const morgan = require("morgan");

const prisma = require("./prisma/client"); // ✅ IMPORTANT (adapter-based Prisma client)

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

app.use("/api/hardware/profit-loss", hardwareProfitLossRoutes);
app.use("/api/hardware/top-selling-products", hardwareTopSelligRoutes);8

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, message: "Internal server error" });
});

// Start server here (no server.js)
const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await prisma.$connect();
    console.log("✅ Prisma connected to DB.");

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Unable to start server:", err);
    process.exit(1);
  }
})();

// graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});

module.exports = app;
