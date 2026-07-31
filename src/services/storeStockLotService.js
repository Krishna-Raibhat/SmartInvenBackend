// src/services/storeStockLotService.js
import { prisma } from "../prisma/client.js";
import { Prisma } from "@prisma/client";

const Decimal = Prisma.Decimal;

class StoreStockLotService {
  
  async create({
    owner_id,
    supplier_id,
    bill_number,
    lot_date,
    items,
  }) {
    if (!supplier_id) {
      throw {
        code: "REQUIRED_FIELDS",
        message: "supplier_id is required.",
      };
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw {
        code: "REQUIRED_FIELDS",
        message: "At least one product is required.",
      };
    }

    if (items.length > 200) {
      throw {
        code: "VALIDATION_ERROR",
        message: "A maximum of 200 products can be added at once.",
      };
    }

    const rawBillNumber =
    bill_number === undefined || bill_number === null
      ? ""
      : String(bill_number).trim();

  const normalizedBillNumber =
    rawBillNumber.length > 0
      ? rawBillNumber
      : null;
    if (
      normalizedBillNumber &&
      normalizedBillNumber.length > 100
    ) {
      throw {
        code: "VALIDATION_ERROR",
        message: "Bill number cannot exceed 100 characters.",
      };
    }

    // --- Lot date handling (backdating stock a supplier forgot to add on time) ---
    let normalizedLotDate;
    if (lot_date !== undefined && lot_date !== null && lot_date !== "") {
      const parsedDate = new Date(lot_date);

      if (isNaN(parsedDate.getTime())) {
        throw {
          code: "VALIDATION_ERROR",
          message: "Invalid lot date.",
        };
      }

      if (parsedDate.getTime() > Date.now()) {
        throw {
          code: "VALIDATION_ERROR",
          message: "Lot date cannot be in the future.",
        };
      }

      normalizedLotDate = parsedDate;
    }

    const normalizedItems = items.map((item, index) => {
      const row = index + 1;

      if (!item.product_id) {
        throw {
          code: "REQUIRED_FIELDS",
          message: `Product is required for row ${row}.`,
        };
      }

      if (
        item.qty_in === undefined ||
        item.qty_in === null
      ) {
        throw {
          code: "REQUIRED_FIELDS",
          message: `Quantity is required for row ${row}.`,
        };
      }

      if (item.cp === undefined || item.cp === null) {
        throw {
          code: "REQUIRED_FIELDS",
          message: `Cost price is required for row ${row}.`,
        };
      }

      if (item.sp === undefined || item.sp === null) {
        throw {
          code: "REQUIRED_FIELDS",
          message: `Selling price is required for row ${row}.`,
        };
      }

      const qtyIn = Number(item.qty_in);
      const cp = Number(item.cp);
      const sp = Number(item.sp);

      if (!Number.isInteger(qtyIn) || qtyIn <= 0) {
        throw {
          code: "VALIDATION_ERROR",
          message:
            `Quantity must be a positive whole number for row ${row}.`,
        };
      }

      if (!Number.isFinite(cp) || cp < 0) {
        throw {
          code: "VALIDATION_ERROR",
          message: `Invalid cost price for row ${row}.`,
        };
      }

      if (!Number.isFinite(sp) || sp < 0) {
        throw {
          code: "VALIDATION_ERROR",
          message: `Invalid selling price for row ${row}.`,
        };
      }

      return {
        product_id: String(item.product_id),
        qty_in: qtyIn,
        cp,
        sp,
      };
    });

    return prisma.$transaction(
      async (tx) => {
        const supplier =
          await tx.storeSupplier.findFirst({
            where: {
              supplier_id,
              owner_id,
            },
          });

        if (!supplier) {
          throw {
            code: "SUPPLIER_NOT_FOUND",
            message: "Supplier not found.",
          };
        }

        const productIds = [
          ...new Set(
            normalizedItems.map(
              (item) => item.product_id,
            ),
          ),
        ];

        const products =
          await tx.storeProduct.findMany({
            where: {
              owner_id,
              product_id: {
                in: productIds,
              },
            },
            include: {
              category: true,
              unit: true,
            },
          });

        const productMap = new Map(
          products.map((product) => [
            product.product_id,
            product,
          ]),
        );

        for (const item of normalizedItems) {
          const product =
            productMap.get(item.product_id);

          if (!product) {
            throw {
              code: "PRODUCT_NOT_FOUND",
              message:
                "One or more selected products were not found.",
              details: {
                product_id: item.product_id,
              },
            };
          }

          if (product.type === "service") {
            throw {
              code: "VALIDATION_ERROR",
              message:
                `Stock cannot be added for service "${product.product_name}".`,
              details: {
                product_id: product.product_id,
              },
            };
          }
        }

        // /*
        // * Check the bill number once.
        // *
        // * The lots created in this transaction may all share it.
        // */
        // if (normalizedBillNumber) {
        //   const existingBill =
        //     await tx.storeStockLot.findFirst({
        //       where: {
        //         owner_id,
        //         bill_number: {
        //           equals: normalizedBillNumber,
        //           mode: "insensitive",
        //         },
        //       },
        //       select: {
        //         lot_id: true,
        //       },
        //     });

        //   if (existingBill) {
        //     throw {
        //       code: "BILL_NUMBER_EXISTS",
        //       message:
        //         "This bill number has already been used.",
        //     };
        //   }
        // }

        const createdLots = [];
        let totalQuantity = 0;
        let totalPurchaseAmount =
          new Decimal(0);

        for (const item of normalizedItems) {
          totalQuantity += item.qty_in;

          totalPurchaseAmount =
            totalPurchaseAmount.plus(
              new Decimal(item.cp).mul(
                item.qty_in,
              ),
            );

          const lot =
            await tx.storeStockLot.create({
              data: {
                owner_id,
                supplier_id,
                product_id: item.product_id,
                qty_in: item.qty_in,
                qty_remaining: item.qty_in,
                cp: item.cp,
                sp: item.sp,
                bill_number:
                  normalizedBillNumber,
                ...(normalizedLotDate && {
                  created_at: normalizedLotDate,
                }),
              },
              include: {
                product: {
                  include: {
                    category: true,
                    unit: true,
                  },
                },
                supplier: true,
              },
            });

          createdLots.push(lot);
        }

        return {
          bill_number: normalizedBillNumber,
          supplier,
          total_products: createdLots.length,
          total_quantity: totalQuantity,
          total_purchase_amount: Number(
            totalPurchaseAmount.toFixed(2),
          ),

          // Helpful for an old frontend expecting one lot.
          lot:
            createdLots.length === 1
              ? createdLots[0]
              : null,

          lots: createdLots,
        };
      },
            {
        maxWait: 10000,
        timeout: 30000,
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }

  async list(owner_id) {
    return prisma.storeStockLot.findMany({
      where: { owner_id },
      orderBy: { created_at: "desc" },
      include: {
        product: { include: { category: true, unit: true } },
        supplier: true,
      },
    });
  }

  async getByProduct(owner_id, product_id) {
    const [product, lots] = await Promise.all([
      prisma.storeProduct.findFirst({
        where: { product_id, owner_id },
        select: { type: true },
      }),
      prisma.storeStockLot.findMany({
        where: { product_id, owner_id },
        orderBy: { created_at: "desc" },
        include: { supplier: true },
      }),
    ]);

    if (!product) throw { code: "PRODUCT_NOT_FOUND", message: "Product not found." };
    if (product.type === "service") throw { code: "VALIDATION_ERROR", message: "Service does not have stock lots." };

    return lots;
  }

  async getById(owner_id, lot_id) {
    const lot = await prisma.storeStockLot.findFirst({
      where: { lot_id, owner_id },
      include: {
        product: { include: { category: true, unit: true } },
        supplier: true,
      },
    });

    if (!lot) throw { code: "NOT_FOUND", message: "Stock lot not found." };
    return lot;
  }

  async update(owner_id, lot_id, { cp, sp, qty_in, qty_remaining, bill_number, lot_date }) {
    const existing = await prisma.storeStockLot.findFirst({
      where: { lot_id, owner_id },
      select: { lot_id: true, qty_in: true, qty_remaining: true },
    });

    if (!existing) throw { code: "NOT_FOUND", message: "Stock lot not found." };

    const currentQtyIn = Number(existing.qty_in);
    const currentQtyRemaining = Number(existing.qty_remaining);
    const qtySold = currentQtyIn - currentQtyRemaining;

    const newQtyIn = qty_in !== undefined ? Number(qty_in) : currentQtyIn;
    const newQtyRemaining = qty_remaining !== undefined ? Number(qty_remaining) : currentQtyRemaining;

    // Fix #3: positive qty_in validation on update
    if (qty_in !== undefined && newQtyIn <= 0) {
      throw { code: "VALIDATION_ERROR", message: "qty_in must be greater than 0." };
    }
    if (newQtyIn < qtySold) {
      throw { code: "VALIDATION_ERROR", message: `qty_in cannot be less than qty sold (${qtySold}).` };
    }
    if (newQtyRemaining > newQtyIn) {
      throw { code: "VALIDATION_ERROR", message: `qty_remaining cannot exceed qty_in (${newQtyIn}).` };
    }
    if (qty_remaining !== undefined && newQtyRemaining < 0) {
      throw { code: "VALIDATION_ERROR", message: "qty_remaining cannot be negative." };
    }

    // Fix #5: positive price validation on update
    if (cp !== undefined && Number(cp) < 0) {
      throw { code: "VALIDATION_ERROR", message: "cp cannot be negative." };
    }
    if (sp !== undefined && Number(sp) < 0) {
      throw { code: "VALIDATION_ERROR", message: "sp cannot be negative." };
    }

    // --- Bill number handling ---
    let normalizedBillNumber;
    if (bill_number !== undefined) {
      const rawBillNumber = bill_number === null ? "" : String(bill_number).trim();
      normalizedBillNumber = rawBillNumber.length > 0 ? rawBillNumber : null;

      if (normalizedBillNumber && normalizedBillNumber.length > 100) {
        throw { code: "VALIDATION_ERROR", message: "Bill number cannot exceed 100 characters." };
      }

      // if (normalizedBillNumber) {
      //   const existingBill = await prisma.storeStockLot.findFirst({
      //     where: {
      //       owner_id,
      //       bill_number: {
      //         equals: normalizedBillNumber,
      //         mode: "insensitive",
      //       },
      //       lot_id: { not: lot_id }, // exclude current lot
      //     },
      //     select: { lot_id: true },
      //   });

      //   if (existingBill) {
      //     throw { code: "BILL_NUMBER_EXISTS", message: "This bill number has already been used." };
      //   }
      // }
    }

    // --- Lot date handling (backdating a lot a supplier forgot to add on time) ---
    let normalizedLotDate;
    const lotDateProvided = lot_date !== undefined && lot_date !== null && lot_date !== "";
    if (lotDateProvided) {
      const parsedDate = new Date(lot_date);

      if (isNaN(parsedDate.getTime())) {
        throw { code: "VALIDATION_ERROR", message: "Invalid lot date." };
      }

      if (parsedDate.getTime() > Date.now()) {
        throw { code: "VALIDATION_ERROR", message: "Lot date cannot be in the future." };
      }

      normalizedLotDate = parsedDate;
    }

    const data = {};
    if (cp !== undefined) data.cp = cp;
    if (sp !== undefined) data.sp = sp;
    if (qty_in !== undefined) data.qty_in = newQtyIn;
    if (qty_remaining !== undefined) data.qty_remaining = newQtyRemaining;
    if (bill_number !== undefined) data.bill_number = normalizedBillNumber;
    if (lotDateProvided) data.created_at = normalizedLotDate;

    // Fix #2: include owner_id in where clause for explicit ownership
    return prisma.storeStockLot.update({
      where: { lot_id, owner_id },
      data,
      include: {
        product: { include: { category: true, unit: true } },
        supplier: true,
      },
    });
  }

  async delete(owner_id, lot_id) {
    const existing = await prisma.storeStockLot.findFirst({
      where: { lot_id, owner_id },
      select: { lot_id: true, qty_in: true, qty_remaining: true },
    });

    if (!existing) throw { code: "NOT_FOUND", message: "Stock lot not found." };

    const qtySold = Number(existing.qty_in) - Number(existing.qty_remaining);
    if (qtySold > 0) {
      throw {
        code: "IN_USE",
        message: `Cannot delete lot. ${qtySold} unit(s) already sold.`,
        details: { qty_sold: qtySold },
      };
    }

    await prisma.storeStockLot.delete({ where: { lot_id } });
    return { message: "Stock lot deleted successfully." };
  }
}

export default new StoreStockLotService();
