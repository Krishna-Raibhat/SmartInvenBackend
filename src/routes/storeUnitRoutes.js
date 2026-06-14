// src/routes/storeUnitRoutes.js
import express from "express";
import storeUnitController from "../controllers/storeUnitController.js";
import auth from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", auth, storeUnitController.create);
router.get("/", auth, storeUnitController.list);
router.get("/:id", auth, storeUnitController.getById);
router.put("/:id", auth, storeUnitController.update);
router.delete("/:id", auth, storeUnitController.delete);

export default router;
