// src/services/hardwareDashboardService.js
import { prisma } from "../prisma/client.js";

class HardwareDashboardService {
  async summary(owner_id) {
    const total_items = await prisma.hardwareProduct.count({ where: { owner_id } });

    const stockInAgg = await prisma.hardwareStockLot.aggregate({
      where: { owner_id },
      _sum: { qty_in: true },
    });

    const stockOutAgg = await prisma.hardwareStockOutItem.aggregate({
      where: { owner_id },
      _sum: { qty: true },
    });

    return {
      total_items,
      total_stock_in: Number(stockInAgg._sum.qty_in || 0),
      total_stock_out: Number(stockOutAgg._sum.qty || 0),
    };
  }
}

export default new HardwareDashboardService();
