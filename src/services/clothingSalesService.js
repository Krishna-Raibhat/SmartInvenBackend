// src/services/clothingSalesService.js
const { prisma } = require("../prisma/client");
const PDFDocument = require("pdfkit");
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

    const doc = new PDFDocument({ size: "A4", margin: 40 });

    const money = (n) => `Rs. ${Number(n || 0).toFixed(2)}`;
    const primary = "#FF6D1F";
    const gray = "#6B7280";
    const light = "#F3F4F6";

    const pageWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // ================= HEADER =================
    doc.rect(40, 40, pageWidth, 70).fill(primary);

    doc.fillColor("white").fontSize(22).text("INVOICE", 50, 60);

    doc
      .fontSize(10)
      .text(`Bill No: ${bill.sale_id}`, 400, 60, { align: "right" });

    doc.text(`Date: ${new Date(bill.created_at).toLocaleString()}`, 400, 75, {
      align: "right",
    });

    doc.moveDown(3);

    // ================= FROM / TO =================
    const leftX = 40;
    const rightX = 300;
    const boxY = 120;
    const boxW = 250;
    const boxH = 100;

    doc.rect(leftX, boxY, boxW, boxH).stroke();
    doc.rect(rightX, boxY, boxW, boxH).stroke();

    doc.fontSize(11).fillColor("black").text("From", leftX + 10, boxY + 8);
    doc.fontSize(10).fillColor(gray);

    doc.text(`Name: ${bill.owner?.full_name || "-"}`, leftX + 10, boxY + 28);
    doc.text(`Phone: ${bill.owner?.phone || "-"}`, leftX + 10, boxY + 44);
    doc.text(`Email: ${bill.owner?.email || "-"}`, leftX + 10, boxY + 60);

    doc.fillColor("black").text("Bill To", rightX + 10, boxY + 8);
    doc.fillColor(gray);

    if (bill.customer) {
      doc.text(`Name: ${bill.customer.full_name}`, rightX + 10, boxY + 28);
      doc.text(`Phone: ${bill.customer.phone || "-"}`, rightX + 10, boxY + 44);
      doc.text(
        `Address: ${bill.customer.address || "-"}`,
        rightX + 10,
        boxY + 60,
      );
    } else {
      doc.text("Walk-in Customer", rightX + 10, boxY + 28);
    }

    doc.y = boxY + boxH + 20;

    // ================= TABLE HEADER =================
    const startX = 40;
    let y = doc.y;

    doc.rect(startX, y, pageWidth, 25).fill(primary);

    doc.fillColor("white").fontSize(10);
    doc.text("SN", startX + 5, y + 8);
    doc.text("Product", startX + 35, y + 8);
    doc.text("Variant", startX + 200, y + 8);
    doc.text("Qty", startX + 340, y + 8, { width: 40, align: "right" });
    doc.text("Rate", startX + 390, y + 8, { width: 60, align: "right" });
    doc.text("Total", startX + 460, y + 8, { width: 80, align: "right" });

    y += 25;

    // ================= TABLE BODY =================
    doc.fillColor("black").fontSize(10);

    bill.items.forEach((it, i) => {
      const variant = `${it.size || "-"} / ${it.color || "-"}`;

      doc.rect(startX, y, pageWidth, 22).stroke();

      doc.text(String(i + 1), startX + 5, y + 6);
      doc.text(it.product_name || "-", startX + 35, y + 6);
      doc.text(variant, startX + 200, y + 6);
      doc.text(String(it.sold_qty || 0), startX + 340, y + 6, {
        width: 40,
        align: "right",
      });
      doc.text(money(it.sp), startX + 390, y + 6, {
        width: 60,
        align: "right",
      });
      doc.text(money(it.line_total), startX + 460, y + 6, {
        width: 80,
        align: "right",
      });

    y += 22;
  });

  // ================= TOTALS =================
  y += 15;

  const totalX = 350;

  doc.fontSize(11).fillColor("black");

  doc.text("Total:", totalX, y);
  doc.text(money(bill.totals.total_amount), totalX + 120, y, {
    align: "right",
  });

  y += 18;
  doc.text("Paid:", totalX, y);
  doc.text(money(bill.totals.paid_amount), totalX + 120, y, {
    align: "right",
  });

  y += 18;
  doc.text("Remaining:", totalX, y);
  doc.fillColor("red").text(
    money(bill.totals.remaining_amount),
    totalX + 120,
    y,
    { align: "right" }
  );

  // ================= NOTE =================
  y += 40;

  doc.fillColor("black").fontSize(11).text("Note:");
  doc.fillColor(gray).fontSize(10).text(bill.note || "-");

  // ================= FOOTER =================
  doc
    .fontSize(10)
    .fillColor(gray)
    .text("Thank you for your business!", 40, doc.page.height - 50, {
      align: "center",
      width: pageWidth,
    });

  // ================= BUFFER =================
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
