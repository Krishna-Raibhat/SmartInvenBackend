const productService = require("../services/hardwareProductService")

//POST /api/hardwareProducts/newProduct
exports.addNewProduct=async(req,res)=>{
    try{
        const{product_name,type,unit}=req.body;
        const owner_id= req.owner.owner_id;

        //require all the fields
        if(!product_name || !type || !unit || !owner_id){
            return res.status(400).json({
                message:"product_name, type, unit and owner_id are required",
            })
        }
        const productData ={owner_id,product_name,type,unit};
        productService.addNewProduct(productData);
        return res.status(200).json({
            message:"product added successfully",
        })

    }
    catch(error){
        console.error("Server error during adding new product", error);
        return res.status(500).json({ message: "Server error during adding new product " });

    }

}

//GET /api/hardwareProducts/
exports.getAll=async(req,res)=>{
    try{
        const ownerId=req.owner.owner_id;
        const products=await productService.getAllProducts(ownerId);
        return res.status(200).json(products)

    }
    catch (error){
        console.error("Server error during getting products", error);
        return res.status(500).json({ message: "Server error during getting products" });
    }
}

//POST /api/hardwareProducts/addUnit
exports.addProductQuantity=async(req,res)=>{
    try{
        const{productId, quantityToAdd}= req.body;

        //require fields
        if(!productId || !quantityToAdd){
            return res.status(400).json({
                message:"productId and quantityToAdd are required",
            });
        }

        const updatedProduct= await productService.addProductQuantity(productId, quantityToAdd);

        return res.status(200).json({
            message:"Product quantity added successfully",
            product:updatedProduct,
        });
    }
    catch (error){
        console.error("Server error during adding product quantity", error);
        return res.status(500).json({ message: "Server error during adding product quantity" });
    }
}

//GET /api/hardwareProducts/:product_id
exports.getProductById=async(req,res)=>{
    try{
        const productId=req.params.product_id;
        
        const product= await productService.getProductById(productId);

        if(!product){
            return res.status(404).json({
                message:"Product not found",
            });
        }


        return res.status(200).json({
            message:"Product fetched successfully",
            product:product,
        });
    }
    catch (error){
        console.error("Server error during fetching product by ID", error);
        return res.status(500).json({ message: "Server error during fetching product by ID" });
    }
}

//POST /api/hardwareProducts/reduceUnit
exports.reduceProductQuantity=async(req,res)=>{
    try{
        const{productId, quantityToReduce}= req.body;

        if(!productId || !quantityToReduce){
            return res.status(400).json({
                message:"productId and quantityToReduce are required",
            });
        }

        const updatedProduct= await productService.reduceProductQuantity(productId, quantityToReduce);

        //check if product quantity is sufficient
        if(!updatedProduct){
            return res.status(400).json({
                message:"Insufficient product quantity to reduce",
            });
        }

        return res.status(200).json({
            message:"Product quantity reduced successfully",
            product:updatedProduct,
        });
    }
    catch (error){
        console.error("Server error during reducing product quantity", error);
        return res.status(500).json({ message: "Server error during reducing product quantity" });
    }
}



//PUT /api/hardwareProducts/update
exports.updateProduct=async(req,res)=>{
    try{
        
        const{productId, productName, type, unit}= req.body;

        if(!productId ){
            return res.status(400).json({
                message:"productId is required",
            });
        }
        if(!(productName || type || unit)){
            return res.status(400).json({
                message:"At least one field (productName, type, unit) must be provided to update",
            });
        }
        const productData={productName,type,unit};

        const updatedProduct= await productService.updateProduct(productId, productData);

        return res.status(200).json({
            message:"Product updated successfully",
            product:updatedProduct,
        });
    }
    catch (error){
        console.error("Server error during updating product", error);
        return res.status(500).json({ message: "Server error during updating product" });
    }
}

//DELETE /api/hardwareProducts/delete/:product_id
exports.deleteProduct=async(req,res)=>{
    try{
        const productId=req.params.product_id;

        const deletedProduct= await productService.deleteProduct(productId);

        return res.status(200).json({
            message:"Product deleted successfully",
            product:deletedProduct,
        });
    }
    catch (error){
        console.error("Server error during deleting product", error);
        return res.status(500).json({ message: "Server error during deleting product" });
    }
}   