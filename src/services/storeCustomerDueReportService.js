import { prisma } from "../prisma/client.js";

class StoreCustomerDueReportService {
  async getReport(owner_id, { from, to }) {
    console.log('📊 Generating customer due report for owner:', owner_id, 'from:', from, 'to:', to);

    // Get all credit sales in the date range
    const rows = await prisma.$queryRaw`
      WITH refunds AS (
        SELECT sales_id, COALESCE(SUM(refund_amount), 0)::numeric AS total_refunded
        FROM store_customer_returns
        WHERE owner_id = ${owner_id}
        GROUP BY sales_id
      ),
      computed AS (
        SELECT
          ss.sales_id, ss.payment_status, ss.payment_method,
          ss.total_amount, ss.discount, ss.paid_amount AS paid_raw,
          ss.created_at, ss.customer_id, c.full_name, c.phone,
          COALESCE(r.total_refunded, 0)::numeric AS total_refunded,
          GREATEST(ss.total_amount - COALESCE(ss.discount, 0), 0) AS effective_total
        FROM store_sales ss
        LEFT JOIN refunds r ON r.sales_id = ss.sales_id
        LEFT JOIN customers c ON c.customer_id = ss.customer_id
        WHERE ss.owner_id = ${owner_id}
          AND DATE(ss.created_at) >= ${from}::date
          AND DATE(ss.created_at) <= ${to}::date
      ),
      final AS (
        SELECT
          sales_id, payment_status, payment_method, total_amount, discount,
          created_at, customer_id, full_name, phone, total_refunded,
          GREATEST(0, effective_total - paid_raw - total_refunded)::numeric AS due_amount,
          GREATEST(0, paid_raw - GREATEST(0, total_refunded - GREATEST(0, effective_total - paid_raw)))::numeric AS net_paid
        FROM computed
      )
      SELECT *
      FROM final
      WHERE due_amount > 0
      ORDER BY due_amount DESC;
    `;

    const dueSales = rows.map((row) => ({
      customerName: row.full_name || 'Walk-in Customer',
      phone: row.phone || '—',
      date: row.created_at,
      totalAmount: Number(row.total_amount) || 0,
      paidAmount: Number(row.net_paid) || 0,
      dueAmount: Number(row.due_amount) || 0,
      paymentMethod: row.payment_method || 'cash',
    }));

    const totalDue = dueSales.reduce((s, x) => s + x.dueAmount, 0);
    const unpaidSalesCount = dueSales.length;
    const avgDuePerSale = unpaidSalesCount > 0 ? totalDue / unpaidSalesCount : 0;

    const uniqueCustomers = new Set(dueSales.map(x => x.customerName));
    const customersWithDue = uniqueCustomers.size;

    // Aging ranges (based on current date diff)
    const now = new Date();
    let freshDue = 0; // <= 7 days old
    let watchDue = 0; // 8 - 30 days old
    let criticalDue = 0; // > 30 days old

    dueSales.forEach((s) => {
      const saleDate = new Date(s.date);
      const diffTime = Math.abs(now - saleDate);
      const daysOld = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      if (daysOld <= 7) {
        freshDue += s.dueAmount;
      } else if (daysOld <= 30) {
        watchDue += s.dueAmount;
      } else {
        criticalDue += s.dueAmount;
      }
    });

    // Payment method breakdown
    let cashDue = 0;
    let onlineDue = 0;

    dueSales.forEach((s) => {
      if (s.paymentMethod.toLowerCase() === 'cash') {
        cashDue += s.dueAmount;
      } else {
        onlineDue += s.dueAmount;
      }
    });

    return {
      totalDue,
      customersWithDue,
      unpaidSalesCount,
      avgDuePerSale,
      freshDue,
      watchDue,
      criticalDue,
      cashDue,
      onlineDue,
      dueSales,
    };
  }
}

export default new StoreCustomerDueReportService();
