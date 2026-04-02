# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project does

Requirements management SaaS. Clients send emails in Spanish with functional requirements; the system parses them, runs an AI agent to extract structured requirements grouped by functional area, and persists them to a database. A manager reviews requirements via a web UI and completes review cycles, which triggers outbound summary emails to the client.

Once requirements are reviewed, an automated pipeline clones a Vite skeleton per project, generates a `USER_REQUIREMENTS.txt`, and launches Claude Code agents autonomously to implement the code.

## Monorepo structure

pnpm + Turborepo. Two deployable Next.js apps (`apps/app` on port 3000, `apps/api` on port 5555) sharing packages under `packages/`.

Key packages:
- `@repo/database` — Prisma 7 + Neon HTTP adapter + RLS helpers
- `@repo/ai` — AI extraction agent (`ToolLoopAgent`, claude-sonnet-4.6 via AI Gateway)
- `@repo/gmail` — Gmail OAuth2: inbound polling + outbound sending
- `@repo/email` — React Email templates + `renderVersionSummary()` (no Resend, uses Gmail)

## Commands

```bash
# Development (from repo root)
./scripts/ejecucion/dev.sh all       # starts app (:3000) + api (:5555)
./scripts/ejecucion/dev.sh app       # app only
./scripts/ejecucion/dev.sh api       # api only
./scripts/ejecucion/stop.sh          # stop all
./scripts/ejecucion/dev.sh cron      # manually trigger Gmail cron (requires api running)
./scripts/ejecucion/dev.sh cron-status  # manually trigger SOLICITADO→ENTORNO_CONSTRUIDO pipeline

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

# Database (uses scripts/despliegue/bbdd/push.sh, reads from scripts/despliegue/bbdd/.db-urls)
./scripts/despliegue/bbdd/push.sh staging   # push schema to PRE (staging branch)
./scripts/despliegue/bbdd/push.sh pro       # push schema to PRO (main branch, asks confirmation)

# RLS — applied manually, NOT by Prisma
psql $DATABASE_URL -f packages/database/prisma/rls/001_enable_rls.sql
```

## Database

**Adapter**: `PrismaNeonHttp` (HTTP/fetch-based). Do NOT use `PrismaNeon` (WebSocket) — it fails in Next.js/Turbopack environments.

**Neon branches**: One Neon project (`lingering-lab-87212404`) with two branches:
- PRE = `staging` branch — used for development
- PRO = `main` branch — production

Connection strings are in `scripts/despliegue/bbdd/.db-urls` (never commit this file). `push.sh` reads from there directly — never from `packages/database/.env`.

**RLS isolation**: All tables except `Project` have Row-Level Security. Always wrap multi-table queries that touch tenant data in `withProjectContext()`:

```typescript
import { database, withProjectContext } from '@repo/database';

const result = await withProjectContext(projectId, (tx) =>
  tx.requirement.findMany({ where: { versionId } })
);
```

Queries outside `withProjectContext` (e.g. `database.project.findMany`) are fine — `Project` has no RLS.

**Prisma config quirk**: `DATABASE_URL` is NOT in `prisma/schema.prisma` (Prisma 7 breaking change). It lives in `packages/database/prisma.config.ts` and is loaded from `packages/database/.env`. Since `prisma.config.ts` uses `??=`, environment variables take precedence over the `.env` file.

## Project status machine

Projects follow an automated lifecycle:

```
SOLICITADO → CREANDO_ENTORNO → ENTORNO_CONSTRUIDO → CREANDO_CODIGO → CODIGO_CREADO → TESTEANDO → TESTADO → SUBIDO_A_STAGING
```

- `SOLICITADO` — initial state when project is created
- `CREANDO_ENTORNO` / `ENTORNO_CONSTRUIDO` — managed by `cron/projects-status` route + `scripts/creacion/clonar_repositorio.sh`
- `CREANDO_CODIGO` / `CODIGO_CREADO` — managed by `cron/desarrollar` routes + `scripts/ejecucion/desarrollar_proyectos.sh`
- Remaining states are set manually by the manager

## Automated development pipeline

### SOLICITADO → ENTORNO_CONSTRUIDO (manual / on-demand)

Triggered via `dev.sh cron-status` or `GET /api/cron/projects-status`.

1. Clones `https://github.com/jalvarez2000/viteapps-skeleton` into `viteapps-projects/<CODE>` (no git history)
2. Generates `viteapps-projects/<CODE>/requirements/USER_REQUIREMENTS.txt` with all requirements and client comments from DB (uses `withProjectContext` for RLS)
3. Updates project status to `ENTORNO_CONSTRUIDO`

### ENTORNO_CONSTRUIDO → CODIGO_CREADO (every 4 hours via crontab)

Triggered by system crontab → `desarrollar-runner.sh` → `desarrollar_proyectos.sh`.

1. `GET /api/cron/desarrollar` — fetches `ENTORNO_CONSTRUIDO` projects, updates them to `CREANDO_CODIGO` atomically
2. Launches one `claude --dangerously-skip-permissions` process per project **in parallel**
3. Each agent reads `requirements/USER_REQUIREMENTS.txt`, implements all requirements, verifies the build
4. `POST /api/cron/desarrollar/complete {id, success}` — updates to `CODIGO_CREADO` (success) or leaves in `CREANDO_CODIGO` (failure)
5. Logs per project: `/tmp/claude-dev/<CODE>-<date>.log`

**Note**: The script handles all status transitions. The Claude agent only writes code — it does NOT update project status.

## Environment variables

Each package exports a `keys()` function using `@t3-oss/env-nextjs`. Apps compose them in `env.ts`. When adding a new env var to a package, add it to the package's `keys.ts` and also add the package's `keys()` call to the relevant app's `env.ts`.

Local dev files needed:
- `apps/app/.env.local` — includes `NEXT_PUBLIC_API_URL=http://localhost:5555`
- `apps/api/.env.local` — includes `CRON_SECRET`
- `packages/database/.env` — includes `DATABASE_URL` (used by Prisma CLI only)

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

## Cron routes

All cron routes in `apps/api` are guarded by `Authorization: Bearer ${CRON_SECRET}`. Key routes:

| Route | Schedule | Description |
|---|---|---|
| `GET /api/cron/gmail` | every minute | Gmail polling |
| `GET /api/cron/backup` | 02:00 daily | DB backup |
| `GET /api/cron/projects-status` | manual only | SOLICITADO → ENTORNO_CONSTRUIDO |
| `GET /api/cron/desarrollar` | manual / 4h crontab | ENTORNO_CONSTRUIDO → CREANDO_CODIGO |
| `POST /api/cron/desarrollar/complete` | called by script | Updates final dev status |

## Key gotchas

- **API port is 5555**: `apps/api` runs on port 5555 (not 3002). All scripts and env vars use 5555.
- **`bun` runtime**: Scripts use `bun --bun next dev`. bun must be in PATH: `export PATH="$HOME/.bun/bin:$PATH"`. pnpm is the package manager; bun is only the runtime.
- **Scripts REPO_ROOT**: Scripts in `scripts/ejecucion/` use `$(dirname "$0")/../..` to reach repo root (two levels up). Scripts in `scripts/creacion/` do the same.
- **`viteapps-projects/` is gitignored**: Generated projects live here. Never commit this directory.
- **`push.sh` reads from `.db-urls`**: Both staging and PRO URLs come from `scripts/despliegue/bbdd/.db-urls`. Never from `packages/database/.env`.
- **`@repo/ai` root index**: `packages/ai/index.ts` re-exports from `./src/index`. TypeScript resolves via `paths` in tsconfig, not `package.json` exports.
- **Collaboration (Liveblocks)**: Not configured. Components in `app/(authenticated)/components/` (avatar-stack, cursors, collaboration-provider) are stubbed as no-ops.
- **Payments**: Not configured. `app/webhooks/payments/route.ts` returns 404.
- **AI Gateway OIDC**: Required for the AI agent in `apps/api`. Run `cd apps/api && vercel link && vercel env pull .env.local` to provision `VERCEL_OIDC_TOKEN`.
- **Dashboard removed**: The root route `/` redirects to `/projects`. Stats (active projects, pending review, open versions) are shown at the top of the projects page.
