import { prisma } from "../prisma/client.js";

class StockOutCreditService {
  async getStockOutWithCreditLeft(owner_id) {
    try {
      const stockOuts = await prisma.hardwareStockOut.findMany({
        where: {
          owner_id,
          payment_status: { in: ["pending", "partial"] }, // ✅ fixed
        },
        orderBy: {
          created_at: "desc",
        },
        include: {
          items: true,
        },
      });

      const summary = stockOuts.map((s) => {
        const totalAmt  = Number(s.total_amount);
        const discount  = Number(s.discount || 0);
        const totalPaid = Number(s.paid_amount);
        const effectiveTotal = totalAmt - discount;   // ✅ discount-aware
        const amtToPay  = effectiveTotal - totalPaid; // ✅ actual remaining

        return {
          stockout_id: s.stockout_id,
          customer_name: s.customer_name,
          customer_phn_number: s.customer_phn_number,
          customer_address: s.customer_address,
          total_amount: totalAmt,
          discount: discount,               // ✅ added
          effective_total: effectiveTotal,  // ✅ added
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

export default new StockOutCreditService();