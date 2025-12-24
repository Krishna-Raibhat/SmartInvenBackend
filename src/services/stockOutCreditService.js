const prisma = require("../prisma/client");

class StockOutCreditService {
  async getStockOutWithCreditLeft(owner_id) {
    try {
      const stockOuts = await prisma.hardwareStockOut.findMany({
        where: {
          owner_id,
          paid_amount: { lt: prisma.hardwareStockOut.fields.total_amount }, //paid_amount less than total_amount
        },
        orderBy: {
          created_at: "desc",
        },
        include: {
          items: true,
        },
      });
      const summary = stockOuts.map((s) => {
        // Calculate totals from items (optional, can also use header total_amount)
        const totalAmt = Number(s.total_amount);
        const totalPaid = Number(s.paid_amount);
        const amtToPay = totalAmt - totalPaid;

        return {
          stockout_id: s.stockout_id,
          customer_name: s.customer_name,
          customer_phn_number: s.customer_phn_number,
          customer_address: s.customer_address,
          total_amount: totalAmt,
          total_paid_amount: totalPaid,
          amount_to_pay: amtToPay,
          payment_status: s.payment_status,
          created_at: s.created_at,
          items: s.items.map((i) => ({
            product_id: i.product_id,
            qty: i.qty,
            sp: Number(i.sp),
            line_total: Number(i.line_total),
          })),
        };
        
      });
      return summary;
    } catch {
      const err = new Error("Failed to fetch stock-out with credit left");
      err.status = 500;
      err.code = "FETCH_FAILED";
      throw err;
    }
  }
}

module.exports = new StockOutCreditService();
