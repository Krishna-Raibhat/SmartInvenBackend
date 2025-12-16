const express =require("express");

const productController =require("../controllers/hardProdController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();


router.get("/",authMiddleware,productController.getAllProducts);
router.post("/newProduct",authMiddleware,productController.addNewProduct);
router.put("/addUnit",authMiddleware,productController.addProductQuantity);
router.put("/reduceUnit",authMiddleware,productController.reduceProductQuantity)

module.exports=router;