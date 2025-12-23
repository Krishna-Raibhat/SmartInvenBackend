const productService = require("../services/hardwareProductService");

const sendFail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });
const sendOk = (res, status, data) =>
  res.status(status).json({ success: true, ...data });

exports.createProduct = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { product_name, category_id } = req.body;

    if (!product_name || !category_id) {
      return sendFail(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "product_name and category_id are required"
      );
    }

    const product = await productService.createProductMaster({
      owner_id,
      product_name,
      category_id,
    });

    return sendOk(res, 201, { data: product });
  } catch (err) {
    if (err?.status) return sendFail(res, err.status, err.code || "ERROR", err.message);
    return sendFail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.listProducts = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const products = await productService.listProducts(owner_id);
    return sendOk(res, 200, { data: products });
  } catch (err) {
    return sendFail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.getProduct = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const product = await productService.getById(owner_id, req.params.product_id);
    if (!product) return sendFail(res, 404, "NOT_FOUND", "Product not found");
    return sendOk(res, 200, { data: product });
  } catch (err) {
    return sendFail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.updateProduct = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { product_name, category_id } = req.body;

    if (product_name === undefined && category_id === undefined) {
      return sendFail(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "At least one field is required to update"
      );
    }

    const updated = await productService.updateProduct(
      owner_id,
      req.params.product_id,
      { product_name, category_id }
    );

    if (!updated) {
      return sendFail(res, 404, "NOT_FOUND", "Product not found");
    }

    return sendOk(res, 200, { data: updated });
  } catch (err) {
    if (err?.status) {
      return sendFail(res, err.status, err.code || "ERROR", err.message);
    }
    return sendFail(res, 500, "SERVER_ERROR", err.message);
  }
};


exports.deleteProduct = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;

    const result = await productService.deleteProduct(owner_id, req.params.product_id);

    if (result === null) return sendFail(res, 404, "NOT_FOUND", "Product not found");
    if (result === false) return sendFail(res, 409, "DELETE_BLOCKED", "Cannot delete product: stock exists");

    return sendOk(res, 200, { message: "Product deleted successfully" });
  } catch (err) {
    return sendFail(res, 500, "SERVER_ERROR", err.message);
  }
};
