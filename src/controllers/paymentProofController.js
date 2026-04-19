// src/controllers/paymentProofController.js
import { prisma } from "../prisma/client.js";
import { uploadToS3 } from "../utils/s3.js";
import { v4 as uuidv4 } from "uuid";

const fail = (res, status, code, message) =>
  res.status(status).json({ success: false, error_code: code, message });

// POST /api/payment-proof
export const upload = async (req, res) => {
  try {
    const owner_id = req.body.owner_id || req.owner?.owner_id;

    if (!owner_id) {
      return fail(res, 400, "OWNER_ID_REQUIRED", "owner_id is required.");
    }

    // verify owner exists
    const owner = await prisma.owner.findUnique({
      where: { owner_id },
      select: { owner_id: true },
    });
    if (!owner) return fail(res, 404, "OWNER_NOT_FOUND", "Owner not found.");

    if (!req.file) {
      return fail(res, 400, "FILE_REQUIRED", "Payment proof image is required.");
    }

    const key = `payment-proofs/${owner_id}/${uuidv4()}.png`;
    const storedKey = await uploadToS3(req.file.buffer, key, req.file.mimetype);

    const proof = await prisma.paymentProof.create({
      data: { owner_id, image_url: storedKey },
      select: { id: true, owner_id: true, image_url: true, status: true, created_at: true },
    });

    return res.status(201).json({ success: true, data: proof });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// GET /api/payment-proof/my
export const myProofs = async (req, res) => {
  try {
    const owner_id = req.owner.owner_id;
    const proofs = await prisma.paymentProof.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
    });
    return res.status(200).json({ success: true, data: proofs });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// GET /api/payment-proof/admin
export const adminList = async (req, res) => {
  try {
    const { status = "pending" } = req.query;
    const proofs = await prisma.paymentProof.findMany({
      where: { status },
      include: {
        owner: { select: { owner_id: true, full_name: true, email: true, phone: true, status: true } },
      },
      orderBy: { created_at: "desc" },
    });
    return res.status(200).json({ success: true, data: proofs });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// PATCH /api/payment-proof/admin/:id/approve
export const approve = async (req, res) => {
  try {
    const { id } = req.params;

    const proof = await prisma.paymentProof.findUnique({ where: { id } });
    if (!proof) return fail(res, 404, "NOT_FOUND", "Payment proof not found.");

    await prisma.$transaction([
      prisma.paymentProof.update({
        where: { id },
        data: { status: "approved", reviewed_at: new Date() },
      }),
      prisma.owner.update({
        where: { owner_id: proof.owner_id },
        data: { status: "active" },
      }),
    ]);

    return res.status(200).json({ success: true, message: "Payment approved. Owner is now active." });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};

// PATCH /api/payment-proof/admin/:id/reject
export const reject = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    const proof = await prisma.paymentProof.findUnique({ where: { id } });
    if (!proof) return fail(res, 404, "NOT_FOUND", "Payment proof not found.");

    await prisma.paymentProof.update({
      where: { id },
      data: { status: "rejected", note: note ?? null, reviewed_at: new Date() },
    });

    return res.status(200).json({ success: true, message: "Payment proof rejected." });
  } catch (err) {
    return fail(res, 500, "SERVER_ERROR", err.message);
  }
};
