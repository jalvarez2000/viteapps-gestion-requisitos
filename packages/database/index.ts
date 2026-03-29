import "server-only";

import { PrismaNeonHttp } from "@prisma/adapter-neon";
import { PrismaClient } from "./generated/client";
import { keys } from "./keys";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

// HTTP transport — works in all environments including Next.js/Turbopack.
// Uses DATABASE_APP_URL (app_user role, no BYPASSRLS) so RLS policies apply.
// $transaction is NOT supported in HTTP mode (Neon limitation).
const adapter = new PrismaNeonHttp(keys().DATABASE_APP_URL, {
  arrayMode: false,
  fullResults: false,
});

export const database = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = database;
}

// ─────────────────────────────────────────
// RLS context helper
//
// Sets app.current_project_id before running queries so the RLS
// policies on app_user can filter rows by project.
//
// IMPORTANT — Neon HTTP adapter limitation:
// Each Prisma call is an independent HTTP request. set_config runs in
// its own request, then the callback runs in a new request. In most
// cases Neon routes both to the same backend session, so the config
// persists for the duration of the Node.js event-loop tick. For true
// transactional isolation, use the WebSocket adapter (PrismaNeon) with
// $transaction — but that adapter is not compatible with Turbopack.
//
// Defense-in-depth: even without session guarantees, explicit projectId
// WHERE clauses in every query provide the primary isolation. The RLS
// policies on app_user add a second layer against accidental omissions.
//
// Usage:
//   const reqs = await withProjectContext(projectId, (tx) =>
//     tx.requirement.findMany({ where: { versionId } })
//   );
// ─────────────────────────────────────────

type TxClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export async function withProjectContext<T>(
  projectId: string,
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  // Set session variable for RLS policies
  await database.$executeRaw`SELECT set_config('app.current_project_id', ${projectId}, false)`;
  return fn(database as unknown as TxClient);
}

export * from "./generated/client";
