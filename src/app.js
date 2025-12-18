// src/app.js
const express = require("express");
const dotenv = require("dotenv");

dotenv.config(); // ✅ load env first

const sequelize = require("./config/database"); // ✅ correct path

// ✅ load models once before sync
require("./models/Owner");
require("./models/PasswordResetOtp");

// Routes
const authRoutes = require("./routes/authRoutes"); // ✅ correct path

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);

// Test route
app.get("/", (req, res) => {
  res.send("Backend is running!");
});

// Start server + DB
(async () => {
  try {
    await sequelize.authenticate();
    console.log(" Database connected.");

    await sequelize.sync(); // dev only
    console.log(" Database synced.");

    app.listen(PORT, () => {
      console.log(` Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error(" Unable to start server:", err);
    process.exit(1);
  }
})();

module.exports = app;
