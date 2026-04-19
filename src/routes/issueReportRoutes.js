import express from "express";
const router = express.Router();
import * as ctrl from "../controllers/issueReportController.js";

router.post("/", ctrl.reportIssue);

export default router;
