const express = require("express");
const router = express.Router();
const auth = require("../middlewares/authMiddleware");
const ctrl = require("../controllers/notificationController");

router.get("/", auth, ctrl.list);                 // list notifications
router.post("/mark-all-read", auth, ctrl.markAllRead);
router.post("/:id/read", auth, ctrl.markRead);    // mark one read
router.delete("/:id", auth, ctrl.deleteOne);      // delete one

module.exports = router;
