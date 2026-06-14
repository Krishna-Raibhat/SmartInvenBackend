// src/routes/storeSalesRoutes.js
import express from "express";
import storeSalesController from "../controllers/storeSalesController.js";
import auth from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/", auth, storeSalesController.create);
router.get("/", auth, storeSalesController.list);
router.get("/credit", auth, storeSalesController.listCredit);
router.get("/:id", auth, storeSalesController.getById);
router.patch("/:id/pay", auth, storeSalesController.addPayment);

export default router;
