import 'server-only';

import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';
import { PrismaClient } from './generated/client';
import { keys } from './keys';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

neonConfig.webSocketConstructor = ws;

const adapter = new PrismaNeon({ connectionString: keys().DATABASE_URL });

export const database =
  globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = database;
}

// ─────────────────────────────────────────
// RLS context helper
//
// Wraps DB operations in a transaction with the project
// context set so RLS policies filter automatically.
//
// Usage:
//   const reqs = await withProjectContext(projectId, (tx) =>
//     tx.requirement.findMany({ where: { versionId } })
//   );
// ─────────────────────────────────────────

type TxClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

export async function withProjectContext<T>(
  projectId: string,
  fn: (tx: TxClient) => Promise<T>
): Promise<T> {
  return database.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.current_project_id', ${projectId}, true)`;
    return fn(tx);
  });
}

export * from './generated/client';
