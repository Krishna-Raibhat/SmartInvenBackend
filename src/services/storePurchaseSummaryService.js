// src/services/storePurchaseSummaryService.js

import { prisma } from "../prisma/client.js";

function startOfDay(dateString) {
  const date = new Date(
    `${dateString}T00:00:00`,
  );

  date.setHours(0, 0, 0, 0);

  return date;
}

function endOfDay(dateString) {
  const date = new Date(
    `${dateString}T00:00:00`,
  );

  date.setHours(23, 59, 59, 999);

  return date;
}

function formatDateOnly(date) {
  if (!date) {
    return null;
  }

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

class StorePurchaseSummaryService {
  async getReport(
    ownerId,
    {
      from,
      to,
    },
  ) {
    const rangeStart =
      startOfDay(from);

    const rangeEnd =
      endOfDay(to);

    const currentDateFilter = {
      gte: rangeStart,
      lte: rangeEnd,
    };

    /*
     * Calculate the previous period using the same
     * number of calendar days as the current period.
     */
    const periodDays =
      this._daysBetweenInclusive(
        from,
        to,
      );

    const previousEnd =
      this._subtractDays(
        from,
        1,
      );

    const previousStart =
      this._subtractDays(
        previousEnd,
        periodDays - 1,
      );

    const previousRangeStart =
      startOfDay(previousStart);

    const previousRangeEnd =
      endOfDay(previousEnd);

    /*
     * All independent database operations execute
     * concurrently.
     *
     * supplierDueRows replaces the previous N+1 query:
     * - no separate lots query per supplier
     * - no separate returns query per supplier
     */
    const [
      lots,
      returns,
      previousRows,
      supplierDueRows,
    ] = await Promise.all([
      prisma.storeStockLot.findMany({
        where: {
          owner_id: ownerId,
          created_at:
            currentDateFilter,
        },

        select: {
          lot_id: true,
          supplier_id: true,
          cp: true,
          qty_in: true,
          qty_remaining: true,
          created_at: true,

          product: {
            select: {
              product_name: true,
            },
          },

          supplier: {
            select: {
              supplier_id: true,
              supplier_name: true,
              phone: true,
              paid_amount: true,
              payment_status: true,
            },
          },
        },

        orderBy: {
          created_at: "asc",
        },
      }),

      prisma.storeSupplierReturn.findMany({
        where: {
          owner_id: ownerId,
          created_at:
            currentDateFilter,
        },

        select: {
          return_id: true,
          supplier_id: true,
          total_refund: true,
          created_at: true,

          supplier: {
            select: {
              supplier_id: true,
              supplier_name: true,
              phone: true,
              paid_amount: true,
              payment_status: true,
            },
          },

          items: {
            select: {
              qty: true,
            },
          },
        },
      }),

      prisma.$queryRaw`
        SELECT
          (
            SELECT
              COALESCE(
                SUM(cp * qty_in),
                0
              )::numeric

            FROM store_stock_lots

            WHERE owner_id = ${ownerId}
              AND created_at >= ${previousRangeStart}
              AND created_at <= ${previousRangeEnd}
          ) AS total_purchases,

          (
            SELECT
              COALESCE(
                SUM(total_refund),
                0
              )::numeric

            FROM store_supplier_returns

            WHERE owner_id = ${ownerId}
              AND created_at >= ${previousRangeStart}
              AND created_at <= ${previousRangeEnd}
          ) AS total_returns
      `,

      prisma.$queryRaw`
        SELECT
          supplier.supplier_id,

          COALESCE(
            supplier.paid_amount,
            0
          )::numeric AS paid_amount,

          COALESCE(
            purchases.total_purchased,
            0
          )::numeric AS total_purchased,

          COALESCE(
            supplier_returns.total_returned,
            0
          )::numeric AS total_returned,

          GREATEST(
            COALESCE(
              purchases.total_purchased,
              0
            ) -
            COALESCE(
              supplier_returns.total_returned,
              0
            ) -
            COALESCE(
              supplier.paid_amount,
              0
            ),
            0
          )::numeric AS actual_due

        FROM store_suppliers supplier

        LEFT JOIN (
          SELECT
            supplier_id,

            COALESCE(
              SUM(cp * qty_in),
              0
            )::numeric AS total_purchased

          FROM store_stock_lots

          WHERE owner_id = ${ownerId}

          GROUP BY supplier_id
        ) purchases
          ON purchases.supplier_id =
             supplier.supplier_id

        LEFT JOIN (
          SELECT
            supplier_id,

            COALESCE(
              SUM(total_refund),
              0
            )::numeric AS total_returned

          FROM store_supplier_returns

          WHERE owner_id = ${ownerId}

          GROUP BY supplier_id
        ) supplier_returns
          ON supplier_returns.supplier_id =
             supplier.supplier_id

        WHERE supplier.owner_id = ${ownerId}
      `,
    ]);

    /*
     * Previous-period net spend.
     */
    const previousPurchases = Number(
      previousRows[0]
        ?.total_purchases || 0,
    );

    const previousReturns = Number(
      previousRows[0]
        ?.total_returns || 0,
    );

    const previousNetSpend =
      previousPurchases -
      previousReturns;

    /*
     * Build actual all-time due information for each
     * supplier.
     */
    const dueBySupplier =
      new Map();

    const paidBySupplier =
      new Map();

    let unpaidDue = 0;
    let partialDue = 0;

    for (const row of supplierDueRows) {
      const supplierId =
        row.supplier_id;

      const paidAmount = Number(
        row.paid_amount || 0,
      );

      const actualDue = Number(
        row.actual_due || 0,
      );

      dueBySupplier.set(
        supplierId,
        actualDue,
      );

      paidBySupplier.set(
        supplierId,
        paidAmount,
      );

      if (actualDue <= 0) {
        continue;
      }

      if (paidAmount <= 0) {
        unpaidDue += actualDue;
      } else {
        partialDue += actualDue;
      }
    }

    /*
     * Aggregate purchases and returns per supplier.
     */
    const supplierMap =
      new Map();

    const ensureSupplier = (
      supplier,
    ) => {
      if (!supplier) {
        return null;
      }

      const supplierId =
        supplier.supplier_id;

      if (
        !supplierMap.has(
          supplierId,
        )
      ) {
        supplierMap.set(
          supplierId,
          {
            supplier_id:
              supplierId,

            supplier_name:
              supplier.supplier_name ||
              "Unknown supplier",

            phone:
              supplier.phone || "",

            total_spend: 0,
            total_returned: 0,

            total_lots: 0,

            total_qty_purchased: 0,
            total_qty_returned: 0,
            total_qty_remaining: 0,

            last_purchased_at:
              null,

            _productSpend:
              new Map(),
          },
        );
      }

      return supplierMap.get(
        supplierId,
      );
    };

    /*
     * Purchases.
     */
    for (const lot of lots) {
      const supplierEntry =
        ensureSupplier(
          lot.supplier,
        );

      if (!supplierEntry) {
        continue;
      }

      const costPrice = Number(
        lot.cp || 0,
      );

      const quantityIn = Number(
        lot.qty_in || 0,
      );

      const quantityRemaining =
        Number(
          lot.qty_remaining || 0,
        );

      const spend =
        costPrice * quantityIn;

      supplierEntry.total_spend +=
        spend;

      supplierEntry.total_lots +=
        1;

      supplierEntry
        .total_qty_purchased +=
        quantityIn;

      supplierEntry
        .total_qty_remaining +=
        quantityRemaining;

      if (
        !supplierEntry
          .last_purchased_at ||
        lot.created_at >
          supplierEntry
            .last_purchased_at
      ) {
        supplierEntry
          .last_purchased_at =
          lot.created_at;
      }

      const productName =
        lot.product
          ?.product_name ||
        "Unknown";

      const currentProductSpend =
        supplierEntry
          ._productSpend
          .get(productName) || 0;

      supplierEntry
        ._productSpend
        .set(
          productName,
          currentProductSpend +
            spend,
        );
    }

    /*
     * Supplier returns.
     */
    for (const supplierReturn of returns) {
      const supplierEntry =
        ensureSupplier(
          supplierReturn.supplier,
        );

      if (!supplierEntry) {
        continue;
      }

      const returnAmount = Number(
        supplierReturn
          .total_refund || 0,
      );

      const returnedQuantity =
        (
          supplierReturn.items || []
        ).reduce(
          (
            total,
            item,
          ) =>
            total +
            Number(
              item.qty || 0,
            ),
          0,
        );

      supplierEntry
        .total_returned +=
        returnAmount;

      supplierEntry
        .total_qty_returned +=
        returnedQuantity;
    }

    /*
     * Format supplier response.
     */
    const suppliers = [
      ...supplierMap.values(),
    ]
      .map((supplier) => {
        let topProduct = "—";
        let topProductSpend = 0;

        for (
          const [
            productName,
            productSpend,
          ] of supplier
            ._productSpend
        ) {
          if (
            productSpend >
            topProductSpend
          ) {
            topProductSpend =
              productSpend;

            topProduct =
              productName;
          }
        }

        const grossSpend =
          Number(
            supplier
              .total_spend || 0,
          );

        const returnedAmount =
          Number(
            supplier
              .total_returned || 0,
          );

        const netSpend =
          grossSpend -
          returnedAmount;

        const totalPurchasedQty =
          Number(
            supplier
              .total_qty_purchased ||
              0,
          );

        const returnedQty =
          Number(
            supplier
              .total_qty_returned ||
              0,
          );

        const netPurchasedQty =
          totalPurchasedQty -
          returnedQty;

        const actualDue = Number(
          dueBySupplier.get(
            supplier.supplier_id,
          ) || 0,
        );

        const paidAmount = Number(
          paidBySupplier.get(
            supplier.supplier_id,
          ) || 0,
        );

        let paymentStatus = "paid";

        if (actualDue > 0) {
          paymentStatus =
            paidAmount > 0
              ? "partial"
              : "unpaid";
        }

        return {
          supplier_id:
            supplier.supplier_id,

          supplier_name:
            supplier.supplier_name,

          phone:
            supplier.phone,

          payment_status:
            paymentStatus,

          total_spend: Number(
            grossSpend.toFixed(2),
          ),

          total_returned: Number(
            returnedAmount.toFixed(
              2,
            ),
          ),

          net_spend: Number(
            netSpend.toFixed(2),
          ),

          total_lots: Number(
            supplier.total_lots ||
              0,
          ),

          total_qty_purchased:
            totalPurchasedQty,

          total_qty_returned:
            returnedQty,

          net_qty_purchased:
            netPurchasedQty,

          total_qty_remaining:
            Math.round(
              Number(
                supplier
                  .total_qty_remaining ||
                  0,
              ),
            ),

          due_amount: Number(
            actualDue.toFixed(2),
          ),

          paid_amount: Number(
            paidAmount.toFixed(2),
          ),

          last_purchased_at:
            formatDateOnly(
              supplier
                .last_purchased_at,
            ),

          top_product:
            topProduct,
        };
      })
      .sort(
        (first, second) =>
          second.net_spend -
          first.net_spend,
      );

    /*
     * Summary values.
     */
    const totalSpend =
      suppliers.reduce(
        (
          total,
          supplier,
        ) =>
          total +
          supplier.total_spend,
        0,
      );

    const totalReturned =
      suppliers.reduce(
        (
          total,
          supplier,
        ) =>
          total +
          supplier.total_returned,
        0,
      );

    const netSpend =
      totalSpend -
      totalReturned;

    const totalLots =
      suppliers.reduce(
        (
          total,
          supplier,
        ) =>
          total +
          supplier.total_lots,
        0,
      );

    const totalQtyPurchased =
      suppliers.reduce(
        (
          total,
          supplier,
        ) =>
          total +
          supplier
            .total_qty_purchased,
        0,
      );

    const totalQtyReturned =
      suppliers.reduce(
        (
          total,
          supplier,
        ) =>
          total +
          supplier
            .total_qty_returned,
        0,
      );

    const totalQtyRemaining =
      suppliers.reduce(
        (
          total,
          supplier,
        ) =>
          total +
          supplier
            .total_qty_remaining,
        0,
      );

    const totalSuppliers =
      suppliers.length;

    const vsLastPeriod =
      this._calculateGrowth(
        netSpend,
        previousNetSpend,
      );

    /*
     * Daily purchase and return trend.
     */
    const trendMap =
      new Map();

    for (const lot of lots) {
      const dateKey =
        formatDateOnly(
          lot.created_at,
        );

      if (!dateKey) {
        continue;
      }

      if (
        !trendMap.has(
          dateKey,
        )
      ) {
        trendMap.set(
          dateKey,
          {
            purchases: 0,
            returns: 0,
          },
        );
      }

      const spend =
        Number(lot.cp || 0) *
        Number(lot.qty_in || 0);

      trendMap.get(
        dateKey,
      ).purchases += spend;
    }

    for (
      const supplierReturn
      of returns
    ) {
      const dateKey =
        formatDateOnly(
          supplierReturn
            .created_at,
        );

      if (!dateKey) {
        continue;
      }

      if (
        !trendMap.has(
          dateKey,
        )
      ) {
        trendMap.set(
          dateKey,
          {
            purchases: 0,
            returns: 0,
          },
        );
      }

      trendMap.get(
        dateKey,
      ).returns += Number(
        supplierReturn
          .total_refund || 0,
      );
    }

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const trend = [
      ...trendMap.entries(),
    ]
      .sort(
        (
          [firstDate],
          [secondDate],
        ) =>
          firstDate.localeCompare(
            secondDate,
          ),
      )
      .map(
        ([
          dateString,
          values,
        ]) => {
          const date = new Date(
            `${dateString}T00:00:00`,
          );

          const purchases = Number(
            values.purchases || 0,
          );

          const returned = Number(
            values.returns || 0,
          );

          const dailyNet =
            purchases -
            returned;

          return {
            d:
              `${date.getDate()} ` +
              `${
                monthNames[
                  date.getMonth()
                ]
              }`,

            purchases: Number(
              purchases.toFixed(2),
            ),

            returns: Number(
              returned.toFixed(2),
            ),

            net: Number(
              dailyNet.toFixed(2),
            ),
          };
        },
      );

    return {
      summary: {
        total_spend: Number(
          totalSpend.toFixed(2),
        ),

        total_returned: Number(
          totalReturned.toFixed(2),
        ),

        net_spend: Number(
          netSpend.toFixed(2),
        ),

        total_lots:
          totalLots,

        total_qty_purchased:
          totalQtyPurchased,

        total_qty_returned:
          totalQtyReturned,

        total_qty_remaining:
          totalQtyRemaining,

        total_suppliers:
          totalSuppliers,

        unpaid_due: Number(
          unpaidDue.toFixed(2),
        ),

        partial_due: Number(
          partialDue.toFixed(2),
        ),

        vs_last_period:
          vsLastPeriod,
      },

      suppliers,
      trend,
    };
  }

  _calculateGrowth(
    current,
    previous,
  ) {
    const currentValue = Number(
      current || 0,
    );

    const previousValue = Number(
      previous || 0,
    );

    if (previousValue === 0) {
      return currentValue > 0
        ? 100
        : 0;
    }

    return Number(
      (
        (
          (
            currentValue -
            previousValue
          ) /
          Math.abs(
            previousValue,
          )
        ) *
        100
      ).toFixed(1),
    );
  }

  _daysBetweenInclusive(
    from,
    to,
  ) {
    const firstDate =
      startOfDay(from);

    const secondDate =
      startOfDay(to);

    const millisecondsPerDay =
      1000 * 60 * 60 * 24;

    return (
      Math.round(
        (
          secondDate -
          firstDate
        ) /
        millisecondsPerDay,
      ) + 1
    );
  }

  _subtractDays(
    dateString,
    days,
  ) {
    const date =
      startOfDay(
        dateString,
      );

    date.setDate(
      date.getDate() -
        days,
    );

    return formatDateOnly(
      date,
    );
  }
}

export default new StorePurchaseSummaryService();