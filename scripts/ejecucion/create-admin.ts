#!/usr/bin/env bun
/**
 * Crea o actualiza un usuario administrador en la base de datos.
 *
 * Uso:
 *   bun scripts/ejecucion/create-admin.ts
 *
 * Lee DATABASE_URL desde packages/database/.env (neondb_owner — tiene BYPASSRLS).
 */

import { createHash, randomBytes, scrypt } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as readline from "node:readline";
import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { PrismaClient } from "../../packages/database/generated/client";

// ─── Load .env ───────────────────────────────────────────────────────────────

function loadEnv(path: string): void {
  try {
    const content = readFileSync(path, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        process.env[match[1].trim()] ??= match[2].trim().replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // file not present — rely on environment
  }
}

const repoRoot = join(import.meta.dirname, "../..");
loadEnv(join(repoRoot, "packages/database/.env"));
loadEnv(join(repoRoot, "apps/app/.env.local"));

const dbUrl = process.env.DATABASE_URL ?? process.env.DATABASE_APP_URL;
if (!dbUrl) {
  console.error("Error: DATABASE_URL o DATABASE_APP_URL no encontrado.");
  console.error("Asegúrate de tener packages/database/.env configurado.");
  process.exit(1);
}

// ─── Prisma client ───────────────────────────────────────────────────────────

const adapter = new PrismaNeonHttp(dbUrl, { arrayMode: false, fullResults: false });
const db = new PrismaClient({ adapter } as never);

// ─── Password hashing (mismo algoritmo que sign-in) ──────────────────────────

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 32, (err, key) => (err ? reject(err) : resolve(key)));
  });
  return `${salt}:${hash.toString("hex")}`;
}

// ─── Prompt helper ───────────────────────────────────────────────────────────

function prompt(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: hidden ? undefined : process.stdout,
    });

    if (hidden) {
      process.stdout.write(question);
      process.stdin.setRawMode?.(true);
      let input = "";
      process.stdin.resume();
      process.stdin.setEncoding("utf8");
      const onData = (char: string) => {
        if (char === "\r" || char === "\n") {
          process.stdin.setRawMode?.(false);
          process.stdin.pause();
          process.stdin.removeListener("data", onData);
          process.stdout.write("\n");
          rl.close();
          resolve(input);
        } else if (char === "\u0003") {
          process.exit();
        } else if (char === "\u007F") {
          input = input.slice(0, -1);
        } else {
          input += char;
        }
      };
      process.stdin.on("data", onData);
    } else {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer);
      });
    }
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n── Crear / actualizar usuario administrador ──\n");

  const name = (await prompt("Nombre:          ")).trim();
  const email = (await prompt("Email:           ")).trim().toLowerCase();
  const password = (await prompt("Contraseña:      ", true)).trim();
  const confirm = (await prompt("Confirmar:       ", true)).trim();

  if (!name || !email || !password) {
    console.error("\nError: todos los campos son obligatorios.");
    process.exit(1);
  }
  if (password !== confirm) {
    console.error("\nError: las contraseñas no coinciden.");
    process.exit(1);
  }
  if (password.length < 8) {
    console.error("\nError: la contraseña debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  const user = await db.adminUser.upsert({
    where: { email },
    create: { email, name, passwordHash },
    update: { name, passwordHash },
    select: { id: true, email: true, name: true },
  });

  console.log(`\n✓ Usuario guardado: ${user.name} <${user.email}> (id: ${user.id})\n`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
