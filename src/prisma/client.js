// src/prisma/client.js

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter ,
  log: ["error", "warn"], });

// module.exports = prisma;


async function connectDB() {
  try {
    await prisma.$connect();
    console.log("✅ Prisma connected to database");
  } catch (error) {
    console.error("❌ Prisma failed to connect");
    throw error; // 🔥 VERY IMPORTANT
  }
}

module.exports = {
  prisma,
  connectDB,
};



