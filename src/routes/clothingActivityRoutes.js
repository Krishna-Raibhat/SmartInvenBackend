// src/routes/clothingActivityRoutes.js
const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clothingActivityController");

router.get("/", auth, ctrl.list); // /api/clothing/activities?limit=4

module.exports = router;
