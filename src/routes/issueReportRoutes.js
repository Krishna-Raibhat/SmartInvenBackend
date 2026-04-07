const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/issueReportController");

router.post("/", ctrl.reportIssue);

module.exports = router;
