import packageService from "../services/packageService.js";

const fail = (res, status, code, message) =>
  res.status(status).json({ success: false, error_code: code, message });

const success = (res, status, data) =>
  res.status(status).json({ success: true, ...data });

// GET /api/packages
export const getAll = async (req, res) => {
  try {
    const packages = await packageService.getAllPackages();
    return success(res, 200, { packages });
  } catch (err) {
    console.error("Get all packages error:", err);
    const statusCode = err.statusCode || 500;
    const errorCode = err.code || "SERVER_ERROR";
    return fail(res, statusCode, errorCode, err.message);
  }
};

// GET /api/packages/:id
export const getById = async (req, res) => {
  try {
    const pkg = await packageService.getPackageById(req.params.id);
    return success(res, 200, { package: pkg });
  } catch (err) {
    console.error("Get package by ID error:", err);
    const statusCode = err.statusCode || 500;
    const errorCode = err.code || "SERVER_ERROR";
    return fail(res, statusCode, errorCode, err.message);
  }
};

// POST /api/packages
export const create = async (req, res) => {
  try {
    const pkg = await packageService.createPackage(req.body);
    return success(res, 201, { package: pkg, message: "Package created successfully." });
  } catch (err) {
    console.error("Create package error:", err);
    const statusCode = err.statusCode || 500;
    const errorCode = err.code || "SERVER_ERROR";
    return fail(res, statusCode, errorCode, err.message);
  }
};

// PUT /api/packages/:id
export const update = async (req, res) => {
  try {
    const pkg = await packageService.updatePackage(req.params.id, req.body);
    return success(res, 200, { package: pkg, message: "Package updated successfully." });
  } catch (err) {
    console.error("Update package error:", err);
    const statusCode = err.statusCode || 500;
    const errorCode = err.code || "SERVER_ERROR";
    return fail(res, statusCode, errorCode, err.message);
  }
};

// DELETE /api/packages/:id
export const deletePackage = async (req, res) => {
  try {
    const result = await packageService.deletePackage(req.params.id);
    return success(res, 200, result);
  } catch (err) {
    console.error("Delete package error:", err);
    const statusCode = err.statusCode || 500;
    const errorCode = err.code || "SERVER_ERROR";
    return fail(res, statusCode, errorCode, err.message);
  }
};
