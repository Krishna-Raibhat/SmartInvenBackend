// src/routes/grocerySalesRoutes.js
import express from "express";
import auth from "../middlewares/authMiddleware.js";
import * as ctrl from "../controllers/grocerySalesController.js";

const router = express.Router();

router.post("/", auth, ctrl.create);
router.get("/", auth, ctrl.list);
router.get("/credit", auth, ctrl.creditList);
router.get("/:sales_id", auth, ctrl.getById);
router.post("/:sales_id/payments", auth, ctrl.addPayment);
router.get("/:sales_id/bill", auth, ctrl.bill);

export default router;
