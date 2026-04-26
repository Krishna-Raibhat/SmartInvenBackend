import express from "express";
import * as ctrl from "../controllers/issueReportController.js";

const router = express.Router();

router.post("/", ctrl.reportIssue);

export default router;
