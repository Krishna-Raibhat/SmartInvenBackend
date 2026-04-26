// src/controllers/clothingStockLotController.js
import service from "../services/clothingStockLotService.js";
import { prisma } from "../prisma/client.js";
import { getObject } from "../utils/s3.js";

const fail = (res, status, error_code, message) =>
  res.status(status).json({ success: false, error_code, message });

export const getAll = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const data = await service.getAll(owner_id);
    return res.status(200).json({ success: true, data, count: data.length });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

export const getBarcodeImage = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { lot_id } = req.params;

    const lot = await prisma.clothingStockLot.findFirst({
      where: { lot_id, product: { owner_id } },
      select: { barcode_image_url: true },
    });

    if (!lot || !lot.barcode_image_url) {
      return fail(res, 404, "NOT_FOUND", "Barcode image not found");
    }

    const stream = await getObject(lot.barcode_image_url);

    res.setHeader("Content-Type", "image/png");
    stream.pipe(res);
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

export const getByBarcode = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const { barcode } = req.params;
    const data = await service.getByBarcode(owner_id, barcode);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

export const bulkCreate = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;

    const { product_id, supplier_id, cp, sp, notes, variants } = req.body;

    if (!product_id || !supplier_id) {
      return fail(
        res,
        400,
        "VALIDATION_REQUIRED_FIELDS",
        "product_id and supplier_id are required"
      );
    }

    const data = await service.bulkCreate(owner_id, {
      product_id,
      supplier_id,
      cp,
      sp,
      notes,
      variants,
    });

    return res.status(201).json({ success: true, data, count: data.lots.length });
  } catch (err) {
    if (err.status) return fail(res, err.status, err.code || "ERROR", err.message);
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};
