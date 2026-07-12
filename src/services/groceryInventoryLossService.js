// src/services/groceryInventoryLossService.js
import prisma from "../prisma/client.js";
import { Prisma } from "@prisma/client";

const Decimal = Prisma.Decimal;

class GroceryInventoryLossService {
  async recordLoss(owner_id, payload) {
    const { lot_id, qty, reason, note } = payload;

    if (!lot_id) {
      const e = new Error("lot_id is required");
      e.status = 400;
      e.code = "VALIDATION_LOT_ID_REQUIRED";
      throw e;
    }

    const qtyDecimal = new Decimal(qty || 0);
    if (qtyDecimal.lte(0)) {
      const e = new Error("qty must be a positive number");
      e.status = 400;
      e.code = "VALIDATION_QTY_INVALID";
      throw e;
    }

    const validReasons = ["expired", "damaged", "spoiled", "other"];
    if (!reason || !validReasons.includes(reason.toLowerCase())) {
      const e = new Error(
        `reason must be one of: ${validReasons.join(", ")}`
      );
      e.status = 400;
      e.code = "VALIDATION_REASON_INVALID";
      throw e;
    }

    return prisma.$transaction(async (tx) => {
      // 1. Fetch lot
      const lot = await tx.groceryStockLot.findFirst({
        where: { lot_id, product: { owner_id } },
        select: {
          lot_id: true,
          product_id: true,
          cp: true,
          qty_remaining: true,
          product: {
            select: { product_name: true },
          },
        },
      });

      if (!lot) {
        const e = new Error("Lot not found or access denied");
        e.status = 404;
        e.code = "LOT_NOT_FOUND";
        throw e;
      }

      const qtyRemaining = new Decimal(lot.qty_remaining);
      if (qtyDecimal.gt(qtyRemaining)) {
        const e = new Error(
          `Not enough stock. Available: ${qtyRemaining.toFixed(3)}`
        );
        e.status = 400;
        e.code = "INSUFFICIENT_STOCK";
        throw e;
      }

      // 2. Calculate loss amount
      const cp = new Decimal(lot.cp);
      const lossAmount = cp.mul(qtyDecimal);

      // 3. Create loss record
      const loss = await tx.groceryInventoryLoss.create({
        data: {
          owner_id,
          lot_id,
          product_id: lot.product_id,
          qty: qtyDecimal,
          cp: cp,
          loss_amount: lossAmount,
          reason: reason.toLowerCase(),
          note: note || null,
        },
      });

      // 4. Reduce lot qty_remaining
      await tx.groceryStockLot.update({
        where: { lot_id },
        data: {
          qty_remaining: { decrement: qtyDecimal },
        },
      });

      return {
        loss_id: loss.loss_id,
        product_name: lot.product.product_name,
        qty: Number(qtyDecimal),
        loss_amount: Number(lossAmount),
        message: "Inventory loss recorded successfully",
      };
    });
  }

  async listLosses(owner_id, { start, end } = {}) {
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;

    const where = { owner_id };
    if (startDate && endDate) {
      where.created_at = { gte: startDate, lte: endDate };
    }

    const losses = await prisma.groceryInventoryLoss.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        product: {
          select: {
            product_name: true,
            unit: { select: { unit_name: true } },
          },
        },
        lot: {
          select: {
            batch_no: true,
            expiry_date: true,
          },
        },
      },
      take: 200,
    });

    return losses.map((loss) => ({
      loss_id: loss.loss_id,
      product_name: loss.product?.product_name,
      unit: loss.product?.unit?.unit_name,
      batch_no: loss.lot?.batch_no,
      expiry_date: loss.lot?.expiry_date,
      qty: Number(loss.qty),
      cp: Number(loss.cp),
      loss_amount: Number(loss.loss_amount),
      reason: loss.reason,
      note: loss.note,
      created_at: loss.created_at,
    }));
  }

  async getSummary(owner_id, { start, end } = {}) {
    const startDate = start ? new Date(start) : null;
    const endDate = end ? new Date(end) : null;

    const where = { owner_id };
    if (startDate && endDate) {
      where.created_at = { gte: startDate, lte: endDate };
    }

    const aggregate = await prisma.groceryInventoryLoss.aggregate({
      where,
      _sum: {
        qty: true,
        loss_amount: true,
      },
      _count: {
        loss_id: true,
      },
    });

    const byReason = await prisma.groceryInventoryLoss.groupBy({
      where,
      by: ["reason"],
      _sum: {
        loss_amount: true,
        qty: true,
      },
    });

    return {
      total_losses: Number(aggregate._sum.loss_amount || 0),
      total_qty: Number(aggregate._sum.qty || 0),
      total_records: aggregate._count.loss_id || 0,
      by_reason: byReason.map((r) => ({
        reason: r.reason,
        loss_amount: Number(r._sum.loss_amount || 0),
        qty: Number(r._sum.qty || 0),
      })),
    };
  }
}

export default new GroceryInventoryLossService();
