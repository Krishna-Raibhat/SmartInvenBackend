const products=require("../models/HardwareProduct");


/*

const getProductByName=async(productName)=>{
    try{
        return await products.findOne({where:{product_name:productName}});
    }
    catch(err){
        throw err;
    }
}
*/

//get all the product
const getAllProducts=async(ownerId)=>{
    return await products.findAll({where:{
        owner_id:ownerId
    }})
}

//get the product
const getProductById=async(productId)=>{
    
    return await products.findOne({
        where:{product_id:productId}
    });
}

//add new product
const addNewProduct=async(productDate)=>{
    
    return await products.create(productDate);
        
}

//when product is added
const addProductQuantity=async(productId,quantityToAdd)=>{
    const product= await getProductById(productId);

    if(!product){
        throw new Error("Product not found");
    }
    product.unit+=quantityToAdd;
    return await product.save();
}


//when product is sold/returned
const reduceProductQuantity=async(productId,quantityToReduce)=>{
    const product= await getProductById(productId);
    if(!product){
        throw new Error("Product not found");
    }

    product.unit-=quantityToReduce;//subtract the quantity

    //check if min quantity is available to subtract
    if(product.unit<0){
        return null;
    }
    return product.save();
}

//when product data needs to be changed (name, type, etc)
const updateProduct= async(productID,productData)=>{
    const product= await getProductById(productID);
    if(!product){
        throw new Error("Product not found");
    }
    if(productData.productName!==undefined){
        product.product_name=productData.productName;
    }
    if(productData.type!==undefined){
        product.type=productData.type;
    }
    if(productData.unit!==undefined){
        product.unit=productData.unit;
    }
    return product.save();

}

//delete the product
const deleteProduct= async(productId)=>{
    const product= await getProductById(productId);
    if(!product){
        throw new Error("Product not found");
    }
    return product.destroy();
}

module.exports={
    getProductById,
    getAllProducts,
    addNewProduct,
    addProductQuantity,
    reduceProductQuantity,
    updateProduct,
    deleteProduct

}