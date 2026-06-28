import { prisma } from "../src/prisma/client.js";

async function main() {
  try {
    const count = await prisma.storeExpense.count();
    console.log("Total expenses in database:", count);

    const firstFive = await prisma.storeExpense.findMany({
      take: 5,
      orderBy: { created_at: "desc" },
      include: { title: true }
    });

    console.log("Latest 5 expenses:");
    console.log(JSON.stringify(firstFive, null, 2));

    // Test a date range query
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    console.log(`Querying date range: ${start.toISOString()} to ${end.toISOString()}`);
    
    // Find owner_id of the latest expense
    if (firstFive.length > 0) {
      const owner_id = firstFive[0].owner_id;
      console.log("Testing with owner_id:", owner_id);

      const inRange = await prisma.storeExpense.findMany({
        where: {
          owner_id,
          created_at: {
            gte: start,
            lte: end
          }
        }
      });
      console.log(`Found ${inRange.length} expenses in range.`);
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
