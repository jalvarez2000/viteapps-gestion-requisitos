# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project does

Requirements management SaaS. Clients send emails in Spanish with functional requirements; the system parses them, runs an AI agent to extract structured requirements grouped by functional area, and persists them to a database. A manager reviews requirements via a web UI and completes review cycles, which triggers outbound summary emails to the client.

## Monorepo structure

pnpm + Turborepo. Two deployable Next.js apps (`apps/app` on port 3000, `apps/api` on port 3002) sharing packages under `packages/`.

Key packages:
- `@repo/database` — Prisma 7 + Neon HTTP adapter + RLS helpers
- `@repo/ai` — AI extraction agent (`ToolLoopAgent`, claude-sonnet-4.6 via AI Gateway)
- `@repo/gmail` — Gmail OAuth2: inbound polling + outbound sending
- `@repo/email` — React Email templates + `renderVersionSummary()` (no Resend, uses Gmail)

## Commands

```bash
# Development (from repo root)
./ejecucion/dev.sh all       # starts app (:3000) + api (:3002)
./ejecucion/dev.sh app       # app only
./ejecucion/dev.sh api       # api only
./ejecucion/stop.sh          # stop all
./ejecucion/dev.sh cron      # manually trigger Gmail cron (requires api running)

# From repo root
pnpm build                   # build all apps
pnpm check                   # lint (Biome via ultracite)
pnpm fix                     # lint + autofix
pnpm test                    # run all tests (Vitest)
pnpm typecheck               # type check all packages (via turbo)

# Per-app typecheck
pnpm --filter app typecheck
pnpm --filter api typecheck
pnpm --filter @repo/ai typecheck

# Database (run from repo root, targets packages/database)
pnpm db:push                 # format + generate + push schema (staging)
pnpm migrate                 # create and run a new migration (dev)
pnpm migrate:deploy          # deploy existing migrations (production)

# RLS — applied manually, NOT by Prisma
psql $DATABASE_URL -f packages/database/prisma/rls/001_enable_rls.sql
```

## Database

**Adapter**: `PrismaNeonHttp` (HTTP/fetch-based). Do NOT use `PrismaNeon` (WebSocket) — it fails in Next.js/Turbopack environments.

**RLS isolation**: All tables except `Project` have Row-Level Security. Always wrap multi-table queries that touch tenant data in `withProjectContext()`:

```typescript
import { database, withProjectContext } from '@repo/database';

const result = await withProjectContext(projectId, (tx) =>
  tx.requirement.findMany({ where: { versionId } })
);
```

Queries outside `withProjectContext` (e.g. `database.project.findMany`) are fine — `Project` has no RLS.

**Prisma config quirk**: `DATABASE_URL` is NOT in `prisma/schema.prisma` (Prisma 7 breaking change). It lives in `packages/database/prisma.config.ts` and is loaded from `packages/database/.env`.

## Environment variables

Each package exports a `keys()` function using `@t3-oss/env-nextjs`. Apps compose them in `env.ts`. When adding a new env var to a package, add it to the package's `keys.ts` and also add the package's `keys()` call to the relevant app's `env.ts`.

Local dev files needed:
- `apps/app/.env.local`
- `apps/api/.env.local`
- `packages/database/.env`

See `TODO.md` for complete variable reference.

## Email flow

**Inbound** (polling, not Pub/Sub):
1. `apps/api/app/api/cron/gmail/route.ts` — runs every minute, guarded by `Authorization: Bearer ${CRON_SECRET}`
2. `fetchUnreadRequirementsEmails()` from `@repo/gmail` — searches Gmail for subjects matching `NUEVA APP:`, `NUEVOS REQUISITOS APP:`, or `COMENTARIOS A REQUISITOS VERSION EN CURSO:`
3. Each email starts `processEmailWorkflow` via `workflow/api start()`

**Outbound**: `sendVersionSummary()` from `@repo/gmail` — sends via Gmail API (OAuth2), not Resend. The `@repo/email` package renders HTML only.

## AI agent

`createRequirementsAgent(projectId, versionId)` returns a `ToolLoopAgent` with three tools:
- `listExistingGroups` — prevent duplicate functional groups
- `createGroup(name, description)` — upsert `RequirementGroup`
- `createRequirement(groupId, title, description)` — create `Requirement` with status `PENDING`

All tool functions use `withProjectContext(projectId, ...)` for RLS. The agent runs in a `'use step'` function inside the workflow.

## Workflow pattern

```typescript
// Workflow orchestrator — durable, survives restarts
export async function myWorkflow(input: Input) {
  'use workflow';
  const result = await myStep(input);
  // ...
}

// Step — retryable, full Node.js access, result cached
async function myStep(input: Input) {
  'use step';
  // database calls, API calls, etc.
}
```

`start()` from `workflow/api` cannot be called directly inside a `'use workflow'` function — wrap it in a `'use step'` function.

## Version state machine

`OPEN → FROZEN → TAGGED` (irreversible forward). `FROZEN` can revert to `OPEN`. Managed in `apps/app/app/actions/requirements/`.

## Key gotchas

- **`bun` runtime**: Scripts use `bun --bun next dev`. bun must be in PATH: `export PATH="$HOME/.bun/bin:$PATH"`. pnpm is the package manager; bun is only the runtime.
- **`@repo/ai` root index**: `packages/ai/index.ts` re-exports from `./src/index`. TypeScript resolves via `paths` in tsconfig, not `package.json` exports.
- **Collaboration (Liveblocks)**: Not configured. Components in `app/(authenticated)/components/` (avatar-stack, cursors, collaboration-provider) are stubbed as no-ops.
- **Payments**: Not configured. `app/webhooks/payments/route.ts` returns 404.
- **AI Gateway OIDC**: Required for the AI agent in `apps/api`. Run `cd apps/api && vercel link && vercel env pull .env.local` to provision `VERCEL_OIDC_TOKEN`.
