import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient() {
  const databaseUrl = new URL(process.env.DATABASE_URL ?? "");
  databaseUrl.searchParams.delete("sslmode");
  databaseUrl.searchParams.delete("ssl");
  const adapter = new PrismaPg({
    connectionString: databaseUrl.toString(),
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}