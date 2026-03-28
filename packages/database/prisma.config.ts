import { defineConfig } from "prisma/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Load .env for Prisma CLI (not loaded automatically outside Next.js)
try {
  const envFile = readFileSync(join(__dirname, ".env"), "utf-8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] ??= match[2].trim().replace(/^["']|["']$/g, "");
  }
} catch {
  // .env not present — rely on environment
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
