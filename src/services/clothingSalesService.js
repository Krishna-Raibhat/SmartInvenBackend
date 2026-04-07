// src/services/clothingSalesService.js
const { prisma } = require("../prisma/client");
const PDFDocument = require("pdfkit");
class ClothingSalesService {
  // ✅ CREATE SALE (can auto create customer)
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
    doc
      .rect(40, 40, pageWidth, 70)
      .fill(primary);

    doc
      .fillColor("white")
      .fontSize(22)
      .text("INVOICE", 50, 60);

    doc
      .fontSize(10)
      .text(`Bill No: ${bill.sale_id}`, 400, 60, { align: "right" });

    doc
      .text(
        `Date: ${new Date(bill.created_at).toLocaleString()}`,
        400,
        75,
        { align: "right" }
      );

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
      doc.text(`Address: ${bill.customer.address || "-"}`, rightX + 10, boxY + 60);
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
    doc
      .fontSize(10)
      .text("S.N.", startX, y, { width: 30 })
      .text("Product", startX + 35, y, { width: 210 })
      .text("Variant", startX + 250, y, { width: 140 })
      .text("Qty", startX + 395, y, { width: 40, align: "right" })
      .text("Rate", startX + 440, y, { width: 60, align: "right" })
      .text("Total", startX + 505, y, { width: 70, align: "right" });

    y += 18;
    doc
      .moveTo(startX, y)
      .lineTo(startX + 535, y)
      .stroke();
    y += 8;

    doc.fontSize(10);
    bill.items.forEach((it, idx) => {
      const variant =
        `${it.size || ""}${it.color ? " / " + it.color : ""}`.trim();

      const rowHeight = 18;
      doc
        .text(String(idx + 1), startX, y, { width: 30 })
        .text(it.product_name || "", startX + 35, y, { width: 210 })
        .text(variant, startX + 250, y, { width: 140 })
        .text(String(it.qty || 0), startX + 395, y, {
          width: 40,
          align: "right",
        })
        .text(money(it.sp), startX + 440, y, { width: 60, align: "right" })
        .text(money(it.line_total), startX + 505, y, {
          width: 70,
          align: "right",
        });

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
