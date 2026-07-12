import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in environment variables");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: ["error", "warn"],
});

async function connectDB() {
  try {
    await prisma.$connect();
    console.log("Prisma connected to database");
  } catch (error) {
    console.error("Prisma failed to connect");
    throw error;
  }
}

export { prisma, connectDB };
export default prisma;