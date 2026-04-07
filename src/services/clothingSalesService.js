// src/services/clothingSalesService.js
const { prisma } = require("../prisma/client");
const PDFDocument = require("pdfkit");
const { normalizeNepalPhone, isValidNepalPhone } = require("../utils/phone");
class ClothingSalesService {
  // ✅ CREATE SALE (can auto create customer)
  async createSale(owner_id, payload) {
    const { customer_id, customer, paid_amount, payment_status, note, items } =
      payload;

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
      const phone = normalizeNepalPhone(String(customer.phone).trim());
      
      if (!isValidNepalPhone(phone)) {
        const e = new Error("Invalid phone number. Please enter a valid 10-digit Nepali number.");
        e.status = 400;
        e.code = "VALIDATION_PHONE_INVALID";
        throw e;
      }

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
          payment_status: payment_status || "pending",
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
          sp,
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
          const e = new Error(
            "Stock lot not found for given product/size/color",
          );
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

      if (paid > totalAmount && payment_status !== "paid") {
        const e = new Error("paid_amount cannot be greater than total_amount");
        e.status = 400;
        e.code = "VALIDATION_PAID_GT_TOTAL";
        throw e;
      }

      let finalStatus = "pending";

      if (payment_status === "paid") {
        // allow completed sale even when paid is less than original total
        finalStatus = "paid";
      } else if (payment_status === "partial") {
        finalStatus = "partial";
      } else {
        if (paid >= totalAmount && totalAmount > 0) finalStatus = "paid";
        else if (paid > 0) finalStatus = "partial";
      }

      const updatedHeader = await tx.clothingSales.update({
        where: { sales_id: header.sales_id },
        data: {
          total_amount: totalAmount,
          paid_amount: paid,
          payment_status: finalStatus,
        },
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
        customer: {
          select: {
            customer_id: true,
            full_name: true,
            phone: true,
            email: true,
            address: true,
          },
        },
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
      include: {
        customer: {
          select: { customer_id: true, full_name: true, phone: true },
        },
      },
      take: 200,
    });
  }

  async listCredit(owner_id) {
    return prisma.clothingSales.findMany({
      where: {
        owner_id,
        OR: [{ payment_status: "pending" }, { payment_status: "partial" }],
      },
      orderBy: { created_at: "desc" },
      include: {
        customer: {
          select: { customer_id: true, full_name: true, phone: true },
        },
      },
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
      totals: {
        total_amount: total,
        paid_amount: paid,
        remaining_amount: remaining,
      },
      owner,
      customer: sale.customer,
      items: sale.items.map((it) => {
        const soldQty = Number(it.qty || 0);
        const returnedQty = Number(it.returned_qty || 0);
        const remainingQty = soldQty - returnedQty;

        return {
          sales_item_id: it.sales_item_id,
          product_name: it.product?.product_name,
          size: it.size?.size_name,
          color: it.color?.color_name,

          sold_qty: soldQty,
          returned_qty: returnedQty,
          remaining_qty: remainingQty,

          sp: Number(it.sp),
          line_total: Number(it.line_total),
          note: it.note,
        };
      }),
      note: sale.note,
    };
  }

  async buildBillPdf(owner_id, sales_id) {
    const bill = await this.getBill(owner_id, sales_id);

    const PDFDocument = require("pdfkit");
    const doc = new PDFDocument({
      size: "A4",
      margin: 40,
      bufferPages: true,
    });

    const chunks = [];
    doc.on("data", (c) => chunks.push(c));

    const pdfBufferPromise = new Promise((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    const money = (n) => `Rs. ${Number(n || 0).toFixed(2)}`;
    const fmtDate = (d) =>
      d ? new Date(d).toLocaleString("en-IN", { hour12: true }) : "-";

    const primary = "#FF6D1F";
    const dark = "#111827";
    const gray = "#6B7280";
    const lightGray = "#E5E7EB";
    const soft = "#F9FAFB";
    const danger = "#DC2626";
    const success = "#059669";

    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;

    const drawText = (text, x, y, options = {}) => {
      doc.text(String(text ?? "-"), x, y, options);
    };

    // ================= HEADER =================
    doc.roundedRect(left, 40, pageWidth, 82, 10).fill(primary);

    doc.fillColor("white").fontSize(24).font("Helvetica-Bold");
    drawText("INVOICE", left + 18, 58);

    doc.fontSize(10).font("Helvetica");
    drawText(`Bill No: ${bill.sale_id}`, left + pageWidth - 180, 56, {
      width: 160,
      align: "right",
    });
    drawText(`Date: ${fmtDate(bill.created_at)}`, left + pageWidth - 180, 74, {
      width: 160,
      align: "right",
    });

    // ================= FROM / BILL TO =================
    const boxY = 145;
    const gap = 16;
    const boxW = (pageWidth - gap) / 2;
    const boxH = 110;

    const drawInfoBox = (title, x, y, lines = []) => {
      doc.roundedRect(x, y, boxW, boxH, 8).fillAndStroke("white", lightGray);

      doc
        .fillColor(primary)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(title, x + 12, y + 10);

      let lineY = y + 32;
      doc.fillColor(dark).font("Helvetica").fontSize(10);

      lines.forEach((line) => {
        doc.text(line, x + 12, lineY, {
          width: boxW - 24,
        });
        lineY += 16;
      });
    };

    drawInfoBox("From", left, boxY, [
      `Name: ${bill.owner?.full_name || "-"}`,
      `Phone: ${bill.owner?.phone || "-"}`,
      `Email: ${bill.owner?.email || "-"}`,
    ]);

    drawInfoBox(
      "Bill To",
      left + boxW + gap,
      boxY,
      bill.customer
        ? [
            `Name: ${bill.customer.full_name || "-"}`,
            `Phone: ${bill.customer.phone || "-"}`,
            `Address: ${bill.customer.address || "-"}`,
          ]
        : ["Walk-in Customer"],
    );

    // ================= TABLE =================
    let y = boxY + boxH + 24;

    const col = {
      sn: left,
      product: left + 30,
      variant: left + 220,
      qty: left + 360,
      rate: left + 410,
      total: left + 490,
    };

    doc.roundedRect(left, y, pageWidth, 26, 6).fill(primary);
    doc.fillColor("white").font("Helvetica-Bold").fontSize(10);

    drawText("SN", col.sn + 6, y + 8);
    drawText("Product", col.product + 4, y + 8);
    drawText("Variant", col.variant + 4, y + 8);
    drawText("Qty", col.qty, y + 8, { width: 35, align: "right" });
    drawText("Rate", col.rate, y + 8, { width: 55, align: "right" });
    drawText("Total", col.total, y + 8, { width: 65, align: "right" });

    y += 30;

    doc.font("Helvetica").fontSize(10);

    bill.items.forEach((it, i) => {
      const variant = `${it.color || "-"} / ${it.size || "-"}`;

      const rowHeight = 26;

      doc
        .roundedRect(left, y, pageWidth, rowHeight, 4)
        .fillAndStroke(i % 2 === 0 ? "white" : soft, lightGray);

      doc.fillColor(dark);

      drawText(i + 1, col.sn + 6, y + 8);
      drawText(it.product_name || "-", col.product + 4, y + 8, {
        width: 175,
        ellipsis: true,
      });
      drawText(variant, col.variant + 4, y + 8, {
        width: 120,
        ellipsis: true,
      });
      drawText(it.sold_qty || 0, col.qty, y + 8, {
        width: 35,
        align: "right",
      });
      drawText(money(it.sp), col.rate, y + 8, {
        width: 55,
        align: "right",
      });
      drawText(money(it.line_total), col.total, y + 8, {
        width: 65,
        align: "right",
      });

      y += rowHeight + 6;
    });

    // ================= TOTALS + NOTE =================
    const sectionTop = y + 16;
    const noteW = 300;
    const totalsW = 190;
    const sectionGap = 20;

    // Note card
    doc
      .roundedRect(left, sectionTop, noteW, 90, 8)
      .fillAndStroke("white", lightGray);
    doc.fillColor(primary).font("Helvetica-Bold").fontSize(11);
    drawText("Note", left + 12, sectionTop + 10);

    doc.fillColor(gray).font("Helvetica").fontSize(10);
    drawText(
      bill.note || "No additional note provided.",
      left + 12,
      sectionTop + 30,
      {
        width: noteW - 24,
      },
    );

    // Totals card
    const totalsX = left + noteW + sectionGap;
    doc
      .roundedRect(totalsX, sectionTop, totalsW, 90, 8)
      .fillAndStroke("white", lightGray);

    const row = (label, value, yy, color = dark, bold = false) => {
      doc.fillColor(gray).font("Helvetica").fontSize(10);
      drawText(label, totalsX + 12, yy);

      doc
        .fillColor(color)
        .font(bold ? "Helvetica-Bold" : "Helvetica")
        .fontSize(10)
        .text(value, totalsX + 80, yy, {
          width: totalsW - 92,
          align: "right",
        });
    };

    row("Total", money(bill.totals.total_amount), sectionTop + 12, dark, true);
    row("Paid", money(bill.totals.paid_amount), sectionTop + 34, success, true);
    row(
      "Remaining",
      money(bill.totals.remaining_amount),
      sectionTop + 56,
      Number(bill.totals.remaining_amount || 0) > 0 ? danger : success,
      true,
    );

    // ================= FOOTER =================
    doc
      .fillColor(gray)
      .font("Helvetica")
      .fontSize(10)
      .text("Thank you for your business!", left, doc.page.height - 45, {
        width: pageWidth,
        align: "center",
      });

    doc.end();

    const pdfBuffer = await pdfBufferPromise;
    return { bill, pdfBuffer };
  }
}

module.exports = new ClothingSalesService();
