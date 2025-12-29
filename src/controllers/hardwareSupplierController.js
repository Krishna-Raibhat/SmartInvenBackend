const supplierService = require("../services/hardwareSupplierService");
const { normalizeNepalPhone, isValidNepalPhone } = require("../utils/phone");

const isValidEmail = (email) =>
  typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

/* =========================
   CREATE SUPPLIER
========================= */
exports.createSupplier = async (req, res) => {
  try {
    let { supplier_name, phone, email, address } = req.body;
    const owner_id = req.owner.owner_id;

    supplier_name = String(supplier_name || "").trim();
    phone = String(phone || "").trim();

    if (!supplier_name || !phone) {
      return fail(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "supplier_name and phone are required."
      );
    }

    phone = normalizeNepalPhone(phone);

    if (!isValidNepalPhone(phone)) {
      return fail(
        res,
        400,
        "VALIDATION_PHONE_INVALID",
        "Invalid phone number. Please enter a valid Nepali number."
      );
    }

    if (email !== undefined && email !== null) {
      email = String(email).trim();
      if (email && !isValidEmail(email)) {
        return fail(
          res,
          400,
          "VALIDATION_EMAIL_INVALID",
          "Invalid email format."
        );
      }
    }

    const supplier = await supplierService.createSupplier({
      owner_id,
      supplier_name,
      phone,
      email,
      address,
    });

    return res.status(201).json({ success: true, data: supplier });
  } catch (error) {
    if (error.status)
      return fail(res, error.status, error.code || "ERROR", error.message);
    console.error("createSupplier error:", error);
    return fail(res, 500, "SERVER_ERROR","Failed to create supplier.");
  }
};

exports.getSuppliers = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const suppliers = await supplierService.getAllSuppliers(owner_id);
    return res.status(200).json({ success: true, data: suppliers });
  } catch (error) {
    return fail(res, 500, "SERVER_ERROR", error.message);
  }
};

exports.getSupplierById = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const supplier = await supplierService.getSupplierById(
      req.params.supplier_id,
      owner_id
    );

    if (!supplier) return fail(res, 404, "NOT_FOUND", "Supplier not found");
    return res.status(200).json({ success: true, data: supplier });
  } catch (error) {
    return fail(res, 500, "SERVER_ERROR", error.message);
  }
};

/* =========================
   UPDATE SUPPLIER
========================= */
exports.updateSupplier = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const supplier_id = req.params.supplier_id;

    let { supplier_name, phone, email, address } = req.body;

    if (
      supplier_name === undefined &&
      phone === undefined &&
      email === undefined &&
      address === undefined
    ) {
      return fail(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "At least one field to update must be provided"
      );
    }

    if (supplier_name !== undefined)
      supplier_name = String(supplier_name || "").trim();

    if (phone !== undefined) {
      phone = normalizeNepalPhone(String(phone || "").trim());

      if (!isValidNepalPhone(phone)) {
        return fail(
          res,
          400,
          "VALIDATION_PHONE_INVALID",
          "Invalid phone number. Please enter a valid Nepali number."
        );
      }
    }

    if (email !== undefined && email !== null) {
      email = String(email).trim();
      if (email && !isValidEmail(email)) {
        return fail(
          res,
          400,
          "VALIDATION_EMAIL_INVALID",
          "Invalid email format."
        );
      }
    }

    const updated = await supplierService.updateSupplier(
      supplier_id,
      owner_id,
      {
        supplier_name,
        phone,
        email, // null allowed
        address, // null allowed
      }
    );

    if (!updated) return fail(res, 404, "NOT_FOUND", "Supplier not found");

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    if (error.status)
      return fail(res, error.status, error.code || "ERROR", error.message);
    return fail(res, 500, "SERVER_ERROR", error.message);
  }
};

exports.deleteSupplier = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const supplier_id = req.params.supplier_id;

    const deleted = await supplierService.deleteSupplier(supplier_id, owner_id);

    if (deleted === null)
      return fail(res, 404, "NOT_FOUND", "Supplier not found");
    if (deleted === false) {
      return fail(
        res,
        409,
        "DELETE_BLOCKED",
        "Cannot delete supplier because it is linked with one or more items/stock entries."
      );
    }

    return res
      .status(200)
      .json({ success: true, message: "Supplier deleted successfully" });
  } catch (error) {
    return fail(res, 500, "SERVER_ERROR", error.message);
  }
};