const router = require("express").Router();

const ctrl=require("../controllers/stockOutCreditController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/credit",authMiddleware,ctrl.getStockOutCredits);

module.exports = router;