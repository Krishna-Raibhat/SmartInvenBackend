const productService= require("../services/HardProdService")
//const productService= require("../services/hardProdService")


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

    }
    catch(error){
        console.error("Server error during adding new product", error);
        return res.status(500).json({ message: "Server error during adding new product " });

    }

}

//GET /api/hardwareProducts/
exports.getAllProducts=async(req,res)=>{
    try{
        const ownerId=req.owner.owner_id;
        return productService.getAllProducts(ownerId);

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

/* TODO: Research more about updating specific fields


exports.updateProduct=async(req,res)=>{
    try{
        
        const{productId, productData}= req.body;

        if(!productId || !productData){
            return res.status(400).json({
                message:"productId and productData are required",
            });
        }

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
}*/