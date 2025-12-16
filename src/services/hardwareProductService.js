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
    
    return await products.findByPk(productId);
}

const addNewProduct=async(productDate)=>{
    
    return await products.create(productDate);
        
}

//when product is added
const addProductQuantity=async(productId,quantityToAdd)=>{
    const product= getProductById(productId);

    if(!product){
        throw new Error("Product not found");
    }
    product.unit+=quantityToAdd;
    return await product.save();
}


//when product is sold/returned
const reduceProductQuantity=async(productId,quantityToReduce)=>{
    const product= getProductById(productId);
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
const updateProduct= async(id,productData)=>{
    const product= getProductById(productId);
    if(!product){
        throw new Error("Product not found");
    }
    return product.update(productData);

}

module.exports={
    getAllProducts,
    addNewProduct,
    addProductQuantity,
    reduceProductQuantity,
    updateProduct

}