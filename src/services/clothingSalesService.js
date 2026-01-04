// src/services/clothingSalesService.js
const {prisma}  = require("../prisma/client");
const PDFDocument = require("pdfkit");
class ClothingSalesService {
  // ✅ CREATE SALE (can auto create customer)
  async createSale(owner_id, payload) {
    const {
      customer_id,
      customer, // { full_name, phone, email, address }
      paid_amount,
      note,
      items,
    } = payload;

    if (!Array.isArray(items) || items.length === 0) {
      const e = new Error("At least one item is required");
      e.status = 400;
      e.code = "VALIDATION_NO_ITEMS";
      throw e;
    }

    const paid = Number(paid_amount ?? 0);
    if (!Number.isFinite(paid) || paid < 0) {
      const e = new Error("paid_amount must be a valid number");
      e.status = 400;
      e.code = "VALIDATION_PAID_INVALID";
      throw e;
    }

    // ✅ resolve customer_id:
    // - if customer_id provided -> must belong to owner
    // - else if customer.phone provided -> find by phone; else create
    let finalCustomerId = customer_id ?? null;

    if (finalCustomerId) {
      const cust = await prisma.customer.findFirst({
        where: { customer_id: finalCustomerId, owner_id },
        select: { customer_id: true },
      });
      if (!cust) {
        const e = new Error("Customer not found for this owner");
        e.status = 404;
        e.code = "CUSTOMER_NOT_FOUND";
        throw e;
      }
    } else if (customer?.phone) {
      const phone = String(customer.phone).trim();

      const existing = await prisma.customer.findFirst({
        where: { owner_id, phone },
        select: { customer_id: true },
      });

      if (existing) {
        finalCustomerId = existing.customer_id;
      } else {
        const created = await prisma.customer.create({
          data: {
            owner_id,
            full_name: String(customer.full_name || "Walk-in Customer").trim(),
            phone,
            email: customer.email ? String(customer.email).trim() : null,
            address: customer.address ? String(customer.address).trim() : null,
          },
          select: { customer_id: true },
        });
        finalCustomerId = created.customer_id;
      }
    } else {
      // no customer info -> allowed (walk-in without saving)
      finalCustomerId = null;
    }

    return prisma.$transaction(async (tx) => {
      // create header first
      const header = await tx.clothingSales.create({
        data: {
          owner_id,
          customer_id: finalCustomerId,
          payment_status: "pending",
          total_amount: 0,
          paid_amount: paid,
          note: note ?? null,
        },
      });

      let totalAmount = 0;
      const createdItems = [];

      for (const item of items) {
        const {
          product_id,
          lot_id,
          size_id,
          color_id,
          qty,
          sp, // ✅ changable at sell time
          note: lineNote,
        } = item;

        const q = Number(qty);
        if (!Number.isInteger(q) || q <= 0) {
          const e = new Error("qty must be a positive integer");
          e.status = 400;
          e.code = "VALIDATION_QTY_INVALID";
          throw e;
        }

        const lot = await tx.clothingStockLot.findFirst({
          where: { lot_id, product_id, size_id, color_id },
          select: { lot_id: true, cp: true, sp: true, qty_remaining: true },
        });

        if (!lot) {
          const e = new Error("Stock lot not found for given product/size/color");
          e.status = 404;
          e.code = "LOT_NOT_FOUND";
          throw e;
        }

        if (lot.qty_remaining < q) {
          const e = new Error("Not enough stock in selected lot");
          e.status = 400;
          e.code = "STOCK_NOT_ENOUGH";
          throw e;
        }

        await tx.clothingStockLot.update({
          where: { lot_id },
          data: { qty_remaining: { decrement: q } },
        });

        const sellingPrice = Number(sp ?? lot.sp);
        if (!Number.isFinite(sellingPrice) || sellingPrice < 0) {
          const e = new Error("sp must be a valid number");
          e.status = 400;
          e.code = "VALIDATION_SP_INVALID";
          throw e;
        }

        const lineTotal = sellingPrice * q;
        totalAmount += lineTotal;

        const created = await tx.clothingSalesItem.create({
          data: {
            sales_id: header.sales_id,
            product_id,
            lot_id,
            size_id,
            color_id,
            qty: q,
            cp: lot.cp,
            sp: sellingPrice,
            line_total: lineTotal,
            note: lineNote ?? null,
          },
        });

        createdItems.push(created);
      }

      if (paid > totalAmount) {
        const e = new Error("paid_amount cannot be greater than total_amount");
        e.status = 400;
        e.code = "VALIDATION_PAID_GT_TOTAL";
        throw e;
      }

      let finalStatus = "pending";
      if (paid >= totalAmount && totalAmount > 0) finalStatus = "paid";
      else if (paid > 0) finalStatus = "partial";

      const updatedHeader = await tx.clothingSales.update({
        where: { sales_id: header.sales_id },
        data: { total_amount: totalAmount, paid_amount: paid, payment_status: finalStatus },
      });

      return {
        ...updatedHeader,
        items: createdItems,
      };
    });
  }

  async getById(owner_id, sales_id) {
    return prisma.clothingSales.findFirst({
      where: { sales_id, owner_id },
      include: {
        customer: { select: { customer_id: true, full_name: true, phone: true, email: true, address: true } },
        items: {
          orderBy: { created_at: "asc" },
          include: {
            product: { select: { product_name: true } },
            size: { select: { size_name: true } },
            color: { select: { color_name: true } },
          },
        },
      },
    });
  }

  async list(owner_id) {
    return prisma.clothingSales.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
      include: { customer: { select: { customer_id: true, full_name: true, phone: true } } },
      take: 200,
    });
  }

  async listCredit(owner_id) {
    return prisma.clothingSales.findMany({
      where: { owner_id, OR: [{ payment_status: "pending" }, { payment_status: "partial" }] },
      orderBy: { created_at: "desc" },
      include: { customer: { select: { customer_id: true, full_name: true, phone: true } } },
      take: 200,
    });
  }

  async addPayment(owner_id, sales_id, add_amount) {
    const add = Number(add_amount);
    if (!Number.isFinite(add) || add <= 0) {
      const e = new Error("amount must be a positive number");
      e.status = 400;
      e.code = "VALIDATION_AMOUNT_INVALID";
      throw e;
    }

    return prisma.$transaction(async (tx) => {
      const sale = await tx.clothingSales.findFirst({
        where: { owner_id, sales_id },
        select: { sales_id: true, total_amount: true, paid_amount: true },
      });
      if (!sale) {
        const e = new Error("Sale not found");
        e.status = 404;
        e.code = "SALE_NOT_FOUND";
        throw e;
      }

      const total = Number(sale.total_amount);
      const currentPaid = Number(sale.paid_amount);
      const newPaid = currentPaid + add;

      if (newPaid > total) {
        const e = new Error("Payment exceeds total amount");
        e.status = 400;
        e.code = "PAYMENT_EXCEEDS_TOTAL";
        throw e;
      }

      let status = "pending";
      if (newPaid >= total && total > 0) status = "paid";
      else if (newPaid > 0) status = "partial";

      return tx.clothingSales.update({
        where: { sales_id },
        data: { paid_amount: newPaid, payment_status: status },
      });
    });
  }

  // ✅ BILL JSON (for printing)
  async getBill(owner_id, sales_id) {
    const sale = await this.getById(owner_id, sales_id);
    if (!sale) {
      const e = new Error("Sale not found");
      e.status = 404;
      e.code = "SALE_NOT_FOUND";
      throw e;
    }

    const owner = await prisma.owner.findUnique({
      where: { owner_id },
      select: { full_name: true, phone: true, email: true },
    });

    const total = Number(sale.total_amount);
    const paid = Number(sale.paid_amount);
    const remaining = total - paid;

    return {
      sale_id: sale.sales_id,
      created_at: sale.created_at,
      payment_status: sale.payment_status,
      totals: { total_amount: total, paid_amount: paid, remaining_amount: remaining },
      owner,
      customer: sale.customer,
      items: sale.items.map((it) => ({
        product_name: it.product?.product_name,
        size: it.size?.size_name,
        color: it.color?.color_name,
        qty: it.qty - (it.returned_qty || 0),
        returned_qty: it.returned_qty,

        sp: Number(it.sp),
        line_total: Number(it.line_total),
        note: it.note,
      })),
      note: sale.note,
    };
  }

 

    async buildBillPdf(owner_id, sales_id) {
    // Reuse existing bill JSON (you already have getBill)
    const bill = await this.getBill(owner_id, sales_id);

    // Create PDF in memory buffers
    const doc = new PDFDocument({ size: "A4", margin: 40 });

    // Helper formatting
    const money = (n) => Number(n || 0).toFixed(2);

    // Header
    doc.fontSize(18).text("INVOICE / BILL", { align: "center" });
    doc.moveDown(0.5);

    doc.fontSize(11);
    doc.text(`Bill No: ${bill.sale_id}`);
    doc.text(`Date: ${new Date(bill.created_at).toLocaleString()}`);
    doc.moveDown(0.5);

    // Owner
    doc.fontSize(12).text("Shop / Owner", { underline: true });
    doc.fontSize(11);
    doc.text(`Name: ${bill.owner?.full_name || ""}`);
    if (bill.owner?.phone) doc.text(`Phone: ${bill.owner.phone}`);
    if (bill.owner?.email) doc.text(`Email: ${bill.owner.email}`);
    doc.moveDown(0.5);

    // Customer
    doc.fontSize(12).text("Customer", { underline: true });
    doc.fontSize(11);
    if (bill.customer) {
        doc.text(`Name: ${bill.customer.full_name || ""}`);
        if (bill.customer.phone) doc.text(`Phone: ${bill.customer.phone}`);
        if (bill.customer.email) doc.text(`Email: ${bill.customer.email}`);
        if (bill.customer.address) doc.text(`Address: ${bill.customer.address}`);
    } else {
        doc.text("Walk-in Customer");
    }
    doc.moveDown(0.5);

    // Status
    doc.fontSize(12).text("Payment", { underline: true });
    doc.fontSize(11);
    doc.text(`Status: ${String(bill.payment_status || "").toUpperCase()}`);
    doc.text(`Total: ${money(bill.totals.total_amount)}`);
    doc.text(`Paid: ${money(bill.totals.paid_amount)}`);
    doc.text(`Remaining: ${money(bill.totals.remaining_amount)}`);
    doc.moveDown(0.8);

    // Items Table
    doc.fontSize(12).text("Items", { underline: true });
    doc.moveDown(0.3);

    const startX = doc.x;
    let y = doc.y;

    // Table headers
    doc.fontSize(10)
        .text("S.N.", startX, y, { width: 30 })
        .text("Product", startX + 35, y, { width: 210 })
        .text("Variant", startX + 250, y, { width: 140 })
        .text("Qty", startX + 395, y, { width: 40, align: "right" })
        .text("Rate", startX + 440, y, { width: 60, align: "right" })
        .text("Total", startX + 505, y, { width: 70, align: "right" });

    y += 18;
    doc.moveTo(startX, y).lineTo(startX + 535, y).stroke();
    y += 8;

    doc.fontSize(10);
    bill.items.forEach((it, idx) => {
        const variant = `${it.size || ""}${it.color ? " / " + it.color : ""}`.trim();

        const rowHeight = 18;
        doc
        .text(String(idx + 1), startX, y, { width: 30 })
        .text(it.product_name || "", startX + 35, y, { width: 210 })
        .text(variant, startX + 250, y, { width: 140 })
        .text(String(it.qty || 0), startX + 395, y, { width: 40, align: "right" })
        .text(money(it.sp), startX + 440, y, { width: 60, align: "right" })
        .text(money(it.line_total), startX + 505, y, { width: 70, align: "right" });

        y += rowHeight;

        // Page break
        if (y > 760) {
        doc.addPage();
        y = doc.y;
        }
    });

    doc.moveDown(1);
    doc.fontSize(11).text(`Note: ${bill.note || "-"}`);

    doc.moveDown(1.5);
    doc.fontSize(10).text("Thank you!", { align: "center" });

    // Collect buffer
    const chunks = [];
    doc.on("data", (c) => chunks.push(c));

    const pdfBuffer = await new Promise((resolve, reject) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
        doc.end();
    });

    return { bill, pdfBuffer };
    }

}

module.exports = new ClothingSalesService();
