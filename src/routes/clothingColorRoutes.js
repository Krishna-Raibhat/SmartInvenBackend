// src/routes/clothingColorRoutes.js
const express = require("express");
const router = express.Router();

const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/clothingColorController");

// /api/clothing/colors
router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/:color_id", auth, ctrl.getById);
router.put("/:color_id", auth, ctrl.update);
router.delete("/:color_id", auth, ctrl.remove);

module.exports = router;
