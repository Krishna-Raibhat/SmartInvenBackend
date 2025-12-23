// src/controllers/hardwareCategoryController.js
const categoryService = require("../services/hardwareCategoryService");

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

exports.createCategory = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const package_id = req.owner.package_id;

    if (!package_id) return fail(res, 400, "NO_PACKAGE", "Owner has no package_id");

    const { category_name } = req.body;
    if (!category_name) {
      return fail(res, 400, "VALIDATION_REQUIRED_FIELDS", "category_name is required");
    }

    const category = await categoryService.createCategory({
      package_id,
      category_name
     
    });

    return res.status(201).json({ success: true, data: category });
  } catch (err) {
    if (err?.status) return fail(res, err.status, err.code || "ERROR", err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.listCategories = async (req, res) => {
  try {
    const package_id = req.owner.package_id;
    if (!package_id) return fail(res, 400, "NO_PACKAGE", "Owner has no package_id");

    const categories = await categoryService.listCategories(package_id);
    return res.status(200).json({ success: true, data: categories });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const package_id = req.owner.package_id;
    if (!package_id) return fail(res, 400, "NO_PACKAGE", "Owner has no package_id");

    const { category_id } = req.params;
    const { category_name } = req.body;

    if (!category_name) {
      return fail(res, 400, "VALIDATION_REQUIRED_FIELDS", "category_name is required");
    }

    const updated = await categoryService.updateCategory(category_id, package_id, { category_name });
    if (!updated) return fail(res, 404, "NOT_FOUND", "Category not found");

    return res.status(200).json({ success: true, data: updated });
  } catch (err) {
    if (err?.status) return fail(res, err.status, err.code || "ERROR", err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const package_id = req.owner.package_id;
    if (!package_id) return fail(res, 400, "NO_PACKAGE", "Owner has no package_id");

    const { category_id } = req.params;

    const result = await categoryService.deleteCategory(category_id, package_id);

    if (result === null) return fail(res, 404, "NOT_FOUND", "Category not found");
    if (result === false) {
      return fail(res, 409, "DELETE_BLOCKED", "Cannot delete category because it is linked with products.");
    }

    return res.status(200).json({ success: true, message: "Category deleted successfully" });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};
