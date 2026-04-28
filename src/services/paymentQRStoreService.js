// src/services/paymentQRStoreService.js
import { prisma } from "../prisma/client.js";
import { uploadToS3, getS3Url } from "../utils/s3.js";
import { v4 as uuidv4 } from "uuid";

class PaymentQRStoreService {
  async create(fileBuffer, mimeType) {
    const key = `payment-qr/${uuidv4()}.png`;
    await uploadToS3(fileBuffer, key, mimeType);

    return prisma.paymentQRStore.create({
      data: { qr_image_path: key },
    });
  }

  async list() {
    const rows = await prisma.paymentQRStore.findMany({
      orderBy: { created_at: "desc" },
    });
    return rows.map((r) => ({ ...r, qr_image_url: getS3Url(r.qr_image_path) }));
  }

  async getById(id) {
    const row = await prisma.paymentQRStore.findUnique({ where: { id } });
    if (!row) return null;
    return { ...row, qr_image_url: getS3Url(row.qr_image_path) };
  }

  async getActive() {
    const row = await prisma.paymentQRStore.findFirst({
      where: { is_active: true },
      orderBy: { created_at: "desc" },
    });
    if (!row) return null;
    return { ...row, qr_image_url: getS3Url(row.qr_image_path) };
  }

  async update(id, fileBuffer, mimeType) {
    const existing = await prisma.paymentQRStore.findUnique({ where: { id } });
    if (!existing) return null;

    const key = `payment-qr/${uuidv4()}.png`;
    await uploadToS3(fileBuffer, key, mimeType);

    return prisma.paymentQRStore.update({
      where: { id },
      data: { qr_image_path: key },
    });
  }

  async setActive(id) {
    const existing = await prisma.paymentQRStore.findUnique({ where: { id } });
    if (!existing) return null;

    // deactivate all, then activate the target
    await prisma.paymentQRStore.updateMany({ data: { is_active: false } });
    return prisma.paymentQRStore.update({
      where: { id },
      data: { is_active: true },
    });
  }

  async setInactive(id) {
    const existing = await prisma.paymentQRStore.findUnique({ where: { id } });
    if (!existing) return null;

    return prisma.paymentQRStore.update({
      where: { id },
      data: { is_active: false },
    });
  }

  async delete(id) {
    const existing = await prisma.paymentQRStore.findUnique({ where: { id } });
    if (!existing) return null;

    await prisma.paymentQRStore.delete({ where: { id } });
    return true;
  }
}

export default new PaymentQRStoreService();
