// src/controllers/clothingSupplierController.js
const clothingSupplierService = require("../services/clothingSupplierService");
const { normalizeNepalPhone, isValidNepalPhone } = require("../utils/phone");

const isValidEmail = (email) =>
  typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

exports.create = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    let { supplier_name, phone, email, address } = req.body;

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
        return fail(res, 400, "VALIDATION_EMAIL_INVALID", "Invalid email format.");
      }
    }

    const supplier = await clothingSupplierService.create({
      owner_id,
      supplier_name,
      phone,
      email: email || null,
      address: address ?? null,
    });

    return res.status(201).json({ success: true, data: supplier });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.list = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const suppliers = await clothingSupplierService.list(owner_id);
    return res.json({ success: true, data: suppliers });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.getById = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const supplier_id = req.params.supplier_id;

    const supplier = await clothingSupplierService.getById(owner_id, supplier_id);
    if (!supplier) return fail(res, 404, "NOT_FOUND", "Supplier not found");

    return res.json({ success: true, data: supplier });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.update = async (req, res) => {
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
        "VALIDATION_NO_FIELDS",
        "At least one field to update must be provided."
      );
    }

    const patch = {};

    if (supplier_name !== undefined) patch.supplier_name = String(supplier_name || "").trim();

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
      patch.phone = phone;
    }

    if (email !== undefined) {
      if (email === null || String(email).trim() === "") patch.email = null;
      else {
        email = String(email).trim();
        if (!isValidEmail(email)) {
          return fail(res, 400, "VALIDATION_EMAIL_INVALID", "Invalid email format.");
        }
        patch.email = email;
      }
    }

    if (address !== undefined) {
      // allow clearing
      patch.address = address === null ? null : String(address).trim();
    }

    const updated = await clothingSupplierService.update(owner_id, supplier_id, patch);
    if (!updated) return fail(res, 404, "NOT_FOUND", "Supplier not found");

    return res.json({ success: true, data: updated });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

exports.remove = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const supplier_id = req.params.supplier_id;

    const deleted = await clothingSupplierService.remove(owner_id, supplier_id);

    if (deleted === null) return fail(res, 404, "NOT_FOUND", "Supplier not found");
    if (deleted === false) {
      return fail(
        res,
        409,
        "DELETE_BLOCKED",
        "Cannot delete supplier because it is linked with one or more stock lots."
      );
    }

    return res.json({ success: true, message: "Supplier deleted successfully" });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};
