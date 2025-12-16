const express =require("express");

const productController =require("../controllers/hardProdController");
const authMiddleware = require("../middlewares/authMiddleware");

const router = express.Router();


router.get("/all",authMiddleware,productController.getAll);
router.post("/newProduct",authMiddleware,productController.addNewProduct);
router.put("/addUnit",authMiddleware,productController.addProductQuantity);
router.put("/reduceUnit",authMiddleware,productController.reduceProductQuantity);
router.get("/:product_id",authMiddleware,productController.getProductById);
router.put("/update",authMiddleware,productController.updateProduct);

router.delete("/:product_id",authMiddleware,productController.deleteProduct);

module.exports=router;