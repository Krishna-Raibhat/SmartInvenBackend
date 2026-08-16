// import cron from "node-cron";
// import { prisma } from "../prisma/client.js";
// import { sendLowStockNotification } from "../services/notificationService.js";
// import { sendClothingLowStockNotification } from "../services/clothingNotificationService.js";
// import { sendGroceryLowStockNotification } from "../services/groceryNotificationService.js";
// import { sendStoreLowStockNotification } from "../services/storeNotificationService.js";

// const LOW_STOCK_THRESHOLD = 40;
// const COOLDOWN_HOURS = 24;

// cron.schedule(
//   "*/5 * * * *", // ✅ every 5 minutes (SAFE)
//   async () => {
//     console.log("🔁 Running unified low stock cron");

//     try {
//       const owners = await prisma.owner.findMany({
//         select: { owner_id: true, fcm_token: true },
//       });

//       const now = new Date();

//       for (const owner of owners) {
//         const ownerId = owner.owner_id;

//         /* ===============================
//            🧰 HARDWARE LOW STOCK
//         =============================== */
//         const hardwareSums = await prisma.hardwareStockLot.groupBy({
//           by: ["product_id"],
//           where: { owner_id: ownerId },
//           _sum: { qty_remaining: true },
//         });

//         if (hardwareSums.length) {
//           const hwMap = new Map(
//             hardwareSums.map(x => [x.product_id, Number(x._sum.qty_remaining || 0)])
//           );

//           const hwProducts = await prisma.hardwareProduct.findMany({
//             where: {
//               owner_id: ownerId,
//               product_id: { in: [...hwMap.keys()] },
//             },
//             select: {
//               product_id: true,
//               product_name: true,
//               last_low_stock_notified_at: true,
//             },
//           });

//           for (const p of hwProducts) {
//             const remaining = hwMap.get(p.product_id) ?? 0;

//             // reset when normal
//             if (remaining >= LOW_STOCK_THRESHOLD && p.last_low_stock_notified_at) {
//               await prisma.hardwareProduct.update({
//                 where: { product_id: p.product_id },
//                 data: { last_low_stock_notified_at: null },
//               });
//               continue;
//             }

//             if (remaining >= LOW_STOCK_THRESHOLD) continue;

//             const last = p.last_low_stock_notified_at;
//             const hours =
//               last ? (now - new Date(last)) / (1000 * 60 * 60) : Infinity;

//             if (hours < COOLDOWN_HOURS) continue;

//             await sendLowStockNotification({
//               owner_id: ownerId,
//               fcmToken: owner.fcm_token ?? null,
//               productId: p.product_id,
//               productName: p.product_name,
//               remainingQty: remaining,
//             });

//             await prisma.hardwareProduct.update({
//               where: { product_id: p.product_id },
//               data: { last_low_stock_notified_at: now },
//             });
//           }
//         }

//         /* ===============================
//            👕 CLOTHING LOW STOCK
//         =============================== */
//         const clothingSums = await prisma.clothingStockLot.groupBy({
//           by: ["product_id"],
//           where: { product: { owner_id: ownerId } },
//           _sum: { qty_remaining: true },
//         });

//         if (clothingSums.length) {
//           const clMap = new Map(
//             clothingSums.map(x => [x.product_id, Number(x._sum.qty_remaining || 0)])
//           );

//           const clProducts = await prisma.clothingProduct.findMany({
//             where: {
//               owner_id: ownerId,
//               product_id: { in: [...clMap.keys()] },
//             },
//             select: {
//               product_id: true,
//               product_name: true,
//               last_low_stock_notified_at: true,
//             },
//           });

//           for (const p of clProducts) {
//             const remaining = clMap.get(p.product_id) ?? 0;

//             if (remaining >= LOW_STOCK_THRESHOLD && p.last_low_stock_notified_at) {
//               await prisma.clothingProduct.update({
//                 where: { product_id: p.product_id },
//                 data: { last_low_stock_notified_at: null },
//               });
//               continue;
//             }

//             if (remaining >= LOW_STOCK_THRESHOLD) continue;

//             const last = p.last_low_stock_notified_at;
//             const hours =
//               last ? (now - new Date(last)) / (1000 * 60 * 60) : Infinity;

//             if (hours < COOLDOWN_HOURS) continue;

//             await sendClothingLowStockNotification({
//               owner_id: ownerId,
//               fcmToken: owner.fcm_token ?? null,
//               productId: p.product_id,
//               productName: p.product_name,
//               remainingQty: remaining,
//             });

//             await prisma.clothingProduct.update({
//               where: { product_id: p.product_id },
//               data: { last_low_stock_notified_at: now },
//             });
//           }
//         }

//         /* ===============================
//            🛒 GROCERY LOW STOCK
//         =============================== */
//         const grocerySums = await prisma.groceryStockLot.groupBy({
//           by: ["product_id"],
//           where: { owner_id: ownerId },
//           _sum: { qty_remaining: true },
//         });

//         if (grocerySums.length) {
//           const grMap = new Map(
//             grocerySums.map(x => [x.product_id, Number(x._sum.qty_remaining || 0)])
//           );

//           const grProducts = await prisma.groceryProduct.findMany({
//             where: {
//               owner_id: ownerId,
//               product_id: { in: [...grMap.keys()] },
//             },
//             select: {
//               product_id: true,
//               product_name: true,
//               last_low_stock_notified_at: true,
//               unit: {
//                 select: {
//                   unit_name: true,
//                 },
//               },
//             },
//           });

//           for (const p of grProducts) {
//             const remaining = grMap.get(p.product_id) ?? 0;

//             if (remaining >= LOW_STOCK_THRESHOLD && p.last_low_stock_notified_at) {
//               await prisma.groceryProduct.update({
//                 where: { product_id: p.product_id },
//                 data: { last_low_stock_notified_at: null },
//               });
//               continue;
//             }

//             if (remaining >= LOW_STOCK_THRESHOLD) continue;

//             const last = p.last_low_stock_notified_at;
//             const hours =
//               last ? (now - new Date(last)) / (1000 * 60 * 60) : Infinity;

//             if (hours < COOLDOWN_HOURS) continue;

//             await sendGroceryLowStockNotification({
//               owner_id: ownerId,
//               fcmToken: owner.fcm_token ?? null,
//               productId: p.product_id,
//               productName: p.product_name,
//               remainingQty: remaining,
//               unitName: p.unit?.unit_name || "units",
//             });

//             await prisma.groceryProduct.update({
//               where: { product_id: p.product_id },
//               data: { last_low_stock_notified_at: now },
//             });
//           }
//         }

//         /* ===============================
//            🏪 STORE LOW STOCK (items only)
//         =============================== */
//         const storeSums = await prisma.storeStockLot.groupBy({
//           by: ["product_id"],
//           where: { owner_id: ownerId },
//           _sum: { qty_remaining: true },
//         });

//        if (storeSums.length) {
//           const stMap = new Map(
//             storeSums.map(x => [x.product_id, Number(x._sum.qty_remaining || 0)])
//           );

//           const stProducts = await prisma.storeProduct.findMany({
//             where: {
//               owner_id: ownerId,
//               type: "item",
//               product_id: { in: [...stMap.keys()] },
//             },
//             select: {
//               product_id: true,
//               product_name: true,
//               low_stock_threshold: true,
//               last_low_stock_notified_at: true,
//               unit: { select: { unit_name: true } },
//             },
//           });

//           for (const p of stProducts) {
//             const remaining = stMap.get(p.product_id) ?? 0;
//             const storeThreshold = p.low_stock_threshold ?? LOW_STOCK_THRESHOLD;

//             if (remaining >= storeThreshold && p.last_low_stock_notified_at) {
//               await prisma.storeProduct.update({
//                 where: { product_id: p.product_id },
//                 data: { last_low_stock_notified_at: null },
//               });
//               continue;
//             }

//             if (remaining >= storeThreshold) continue;

//             const last = p.last_low_stock_notified_at;
//             const hours =
//               last ? (now - new Date(last)) / (1000 * 60 * 60) : Infinity;

//             if (hours < COOLDOWN_HOURS) continue;

//             await sendStoreLowStockNotification({
//               owner_id: ownerId,
//               fcmToken: owner.fcm_token ?? null,
//               productId: p.product_id,
//               productName: p.product_name,
//               remainingQty: remaining,
//               unitName: p.unit?.unit_name || "units",
//             });

//             await prisma.storeProduct.update({
//               where: { product_id: p.product_id },
//               data: { last_low_stock_notified_at: now },
//             });
//           }
//         }
//       }

//       console.log("✅ Low stock cron completed");
//     } catch (err) {
//       console.error("❌ Low stock cron failed:", err.message);
//     }
//   },
//   { timezone: "Asia/Kathmandu" }
// );
import cron from "node-cron";
import { prisma } from "../prisma/client.js";
import { sendLowStockNotification } from "../services/notificationService.js";
import { sendClothingLowStockNotification } from "../services/clothingNotificationService.js";
import { sendGroceryLowStockNotification } from "../services/groceryNotificationService.js";
import { sendStoreLowStockNotification } from "../services/storeNotificationService.js";

const LOW_STOCK_THRESHOLD = 40;
const COOLDOWN_HOURS = 24;
const COOLDOWN_MS = COOLDOWN_HOURS * 60 * 60 * 1000;

/**
 * Processes one product category across ALL owners in a fixed number of
 * queries (no per-owner loop), then applies the reset/notify updates as two
 * batched updateMany() calls instead of one UPDATE per product.
 *
 * getThreshold(product) lets the store category use a per-product threshold
 * while the others fall back to the global LOW_STOCK_THRESHOLD.
 */
async function processCategory({
  stockLotModel,
  stockLotWhere,
  stockLotGroupBy, // ["owner_id", "product_id"]
  productModel,
  productWhere, // extra filter beyond product_id/owner_id, e.g. { type: "item" }
  productSelect,
  getThreshold,
  ownersById,
  now,
  sendNotification,
}) {
  // 1 query: stock totals for every owner/product at once.
  const sums = await stockLotModel.groupBy({
    by: stockLotGroupBy,
    where: stockLotWhere,
    _sum: { qty_remaining: true },
  });
  if (!sums.length) return;

  const hasOwnerInGroup = stockLotGroupBy.includes("owner_id");
  const remainingByProduct = new Map(); // product_id -> { owner_id, remaining }
  for (const row of sums) {
    remainingByProduct.set(row.product_id, {
      owner_id: hasOwnerInGroup ? row.owner_id : row.owner_id ?? null,
      remaining: Number(row._sum.qty_remaining || 0),
    });
  }

  // 1 query: every relevant product across every owner at once.
  const products = await productModel.findMany({
    where: { product_id: { in: [...remainingByProduct.keys()] }, ...productWhere },
    select: { ...productSelect, owner_id: true },
  });

  const resetIds = [];
  const notifyTargets = []; // { product, owner, remaining }

  for (const p of products) {
    const info = remainingByProduct.get(p.product_id);
    if (!info) continue;
    const remaining = info.remaining;
    const threshold = getThreshold ? getThreshold(p) : LOW_STOCK_THRESHOLD;

    if (remaining >= threshold) {
      if (p.last_low_stock_notified_at) resetIds.push(p.product_id);
      continue;
    }

    const last = p.last_low_stock_notified_at;
    const hours = last ? (now - new Date(last)) / (1000 * 60 * 60) : Infinity;
    if (hours < COOLDOWN_HOURS) continue;

    const owner = ownersById.get(p.owner_id);
    notifyTargets.push({ product: p, owner, remaining });
  }

  // 1 batched query instead of N individual updates.
  if (resetIds.length) {
    await productModel.updateMany({
      where: { product_id: { in: resetIds } },
      data: { last_low_stock_notified_at: null },
    });
  }

  if (notifyTargets.length) {
    await Promise.allSettled(
      notifyTargets.map((t) =>
        sendNotification({
          owner_id: t.product.owner_id,
          fcmToken: t.owner?.fcm_token ?? null,
          productId: t.product.product_id,
          productName: t.product.product_name,
          remainingQty: t.remaining,
          unitName: t.product.unit?.unit_name || "units",
        })
      )
    );
    // 1 batched query instead of N individual updates.
    await productModel.updateMany({
      where: { product_id: { in: notifyTargets.map((t) => t.product.product_id) } },
      data: { last_low_stock_notified_at: now },
    });
  }
}

cron.schedule(
  "*/5 * * * *", // every 5 minutes
  async () => {
    console.log("🔁 Running unified low stock cron");

    try {
      const owners = await prisma.owner.findMany({
        select: { owner_id: true, fcm_token: true },
      });
      if (!owners.length) {
        console.log("✅ Low stock cron completed (no owners)");
        return;
      }
      const ownersById = new Map(owners.map((o) => [o.owner_id, o]));
      const now = new Date();

      await Promise.all([
        // 🧰 HARDWARE
        processCategory({
          stockLotModel: prisma.hardwareStockLot,
          stockLotWhere: {},
          stockLotGroupBy: ["owner_id", "product_id"],
          productModel: prisma.hardwareProduct,
          productWhere: {},
          productSelect: { product_id: true, product_name: true, last_low_stock_notified_at: true },
          ownersById,
          now,
          sendNotification: sendLowStockNotification,
        }),

        // 👕 CLOTHING (stock lot is scoped via product relation, not a direct owner_id column)
        processCategory({
          stockLotModel: prisma.clothingStockLot,
          stockLotWhere: {},
          stockLotGroupBy: ["product_id"],
          productModel: prisma.clothingProduct,
          productWhere: {},
          productSelect: { product_id: true, product_name: true, last_low_stock_notified_at: true },
          ownersById,
          now,
          sendNotification: sendClothingLowStockNotification,
        }),

        // 🛒 GROCERY
        processCategory({
          stockLotModel: prisma.groceryStockLot,
          stockLotWhere: {},
          stockLotGroupBy: ["owner_id", "product_id"],
          productModel: prisma.groceryProduct,
          productWhere: {},
          productSelect: {
            product_id: true,
            product_name: true,
            last_low_stock_notified_at: true,
            unit: { select: { unit_name: true } },
          },
          ownersById,
          now,
          sendNotification: sendGroceryLowStockNotification,
        }),

        // 🏪 STORE (items only, per-product threshold)
        processCategory({
          stockLotModel: prisma.storeStockLot,
          stockLotWhere: {},
          stockLotGroupBy: ["owner_id", "product_id"],
          productModel: prisma.storeProduct,
          productWhere: { type: "item" },
          productSelect: {
            product_id: true,
            product_name: true,
            low_stock_threshold: true,
            last_low_stock_notified_at: true,
            unit: { select: { unit_name: true } },
          },
          getThreshold: (p) => p.low_stock_threshold ?? LOW_STOCK_THRESHOLD,
          ownersById,
          now,
          sendNotification: sendStoreLowStockNotification,
        }),
      ]);

      console.log("✅ Low stock cron completed");
    } catch (err) {
      console.error("❌ Low stock cron failed:", err.message);
    }
  },
  { timezone: "Asia/Kathmandu" }
);