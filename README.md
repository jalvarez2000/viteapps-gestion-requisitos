# Gestión de Requisitos

SaaS de gestión de requisitos funcionales para proyectos de desarrollo de software. Los clientes envían emails con requisitos en español; el sistema los extrae con IA, los estructura y los presenta a un gestor para su revisión. Una vez aprobados, el sistema genera automáticamente los proyectos de código correspondientes mediante agentes Claude Code.

## Arquitectura general

```
Cliente (email)
    │
    ▼
apps/api  ──── Gmail polling (cron cada minuto)
    │           └── Extracción con IA (claude-sonnet-4.6)
    │               └── Requisitos persistidos en BD (Neon)
    ▼
apps/app  ──── Revisión del gestor (Next.js, puerto 3000)
    │           └── Aprobación / ciclos de revisión
    ▼
Pipeline de desarrollo automático
    │
    ├── cron-status (manual)   → SOLICITADO → clona skeleton → ENTORNO_CONSTRUIDO
    └── cron-desarrollar (*/4h) → ENTORNO_CONSTRUIDO → agente Claude Code → CODIGO_CREADO
```

## Monorepo

pnpm + Turborepo. Dos apps Next.js desplegables y paquetes compartidos.

```
gestion-requisitos/
├── apps/
│   ├── app/          # UI del gestor (puerto 3000)
│   └── api/          # API + crons + workflows (puerto 5555)
├── packages/
│   ├── database/     # Prisma 7 + Neon HTTP adapter + RLS
│   ├── ai/           # Agente de extracción (ToolLoopAgent)
│   ├── gmail/        # OAuth2: polling inbound + sending outbound
│   └── email/        # React Email templates
├── scripts/
│   ├── ejecucion/    # Scripts de desarrollo local y crons
│   ├── creacion/     # Scripts de creación de proyectos
│   └── despliegue/   # Scripts de deploy (bbdd + aplicación)
└── viteapps-projects/ # Proyectos generados (gitignored)
    └── CODE-001/
        ├── ...        # Skeleton clonado
        └── requirements/
            └── USER_REQUIREMENTS.txt
```

## Estado de un proyecto

Los proyectos siguen un ciclo de vida automático gestionado por los scripts y agentes:

| Estado | Descripción |
|---|---|
| `SOLICITADO` | Estado inicial. Proyecto creado, pendiente de preparar entorno. |
| `CREANDO_ENTORNO` | El script está clonando el skeleton en `viteapps-projects/`. |
| `ENTORNO_CONSTRUIDO` | Skeleton clonado y `USER_REQUIREMENTS.txt` generado. Listo para desarrollo. |
| `CREANDO_CODIGO` | Un agente Claude Code está implementando los requisitos. |
| `CODIGO_CREADO` | Agente terminó. Código implementado sin errores. |
| `TESTEANDO` | En proceso de QA. |
| `TESTADO` | QA superado. |
| `SUBIDO_A_STAGING` | Desplegado en entorno de staging. |

## Comandos de desarrollo

```bash
# Arrancar (desde la raíz del repo)
./scripts/ejecucion/dev.sh all          # app (:3000) + api (:5555)
./scripts/ejecucion/dev.sh app          # solo app
./scripts/ejecucion/dev.sh api          # solo api
./scripts/ejecucion/stop.sh             # parar todo

# Crons manuales (requieren api corriendo en :5555)
./scripts/ejecucion/dev.sh cron         # dispara cron de Gmail
./scripts/ejecucion/dev.sh cron-status  # dispara pipeline SOLICITADO → ENTORNO_CONSTRUIDO

# Build y calidad
pnpm build        # build de todas las apps
pnpm check        # lint (Biome via ultracite)
pnpm fix          # lint + autofix
pnpm test         # tests (Vitest)
pnpm typecheck    # type check via turbo
```

## Pipeline SOLICITADO → ENTORNO_CONSTRUIDO

Ejecutado manualmente con `dev.sh cron-status` o automáticamente si se re-activa el cron.

1. Busca proyectos en estado `SOLICITADO`
2. Los pasa a `CREANDO_ENTORNO`
3. Ejecuta `scripts/creacion/clonar_repositorio.sh <CODIGO>` — clona el skeleton sin historial git en `viteapps-projects/<CODIGO>`
4. Genera `viteapps-projects/<CODIGO>/requirements/USER_REQUIREMENTS.txt` con todos los requisitos y comentarios del proyecto
5. Los pasa a `ENTORNO_CONSTRUIDO`

**Rutas clave:**
- Route: `apps/api/app/api/cron/projects-status/route.ts`
- Script de clonado: `scripts/creacion/clonar_repositorio.sh`
- Skeleton: `https://github.com/jalvarez2000/viteapps-skeleton`

## Pipeline ENTORNO_CONSTRUIDO → CODIGO_CREADO

Ejecutado automáticamente cada 4 horas via crontab del sistema.

1. Llama a `GET /api/cron/desarrollar` — obtiene proyectos `ENTORNO_CONSTRUIDO` y los pasa a `CREANDO_CODIGO`
2. Lanza un proceso `claude --dangerously-skip-permissions` en paralelo por cada proyecto
3. El agente lee `requirements/USER_REQUIREMENTS.txt`, implementa los requisitos y verifica que compile sin errores
4. Al terminar, el script llama a `POST /api/cron/desarrollar/complete` → pasa a `CODIGO_CREADO` (éxito) o deja en `CREANDO_CODIGO` (error)

**Logs:** `/tmp/claude-dev/<CODE>-<fecha>.log` por proyecto

**Rutas clave:**
- `apps/api/app/api/cron/desarrollar/route.ts`
- `apps/api/app/api/cron/desarrollar/complete/route.ts`
- `scripts/ejecucion/desarrollar_proyectos.sh`
- `scripts/ejecucion/desarrollar-runner.sh`

## Base de datos

Neon (PostgreSQL serverless). Un proyecto con dos branches:

| Branch | Uso | Variable |
|---|---|---|
| `staging` (PRE) | Desarrollo y pruebas | `DB_STAGING_OWNER_URL` |
| `main` (PRO) | Producción | `DB_PRO_OWNER_URL` |

Credenciales en `scripts/despliegue/bbdd/.db-urls` (no commitear).

```bash
# Push de schema
./scripts/despliegue/bbdd/push.sh staging
./scripts/despliegue/bbdd/push.sh pro     # pide confirmación
```

**RLS**: Todas las tablas excepto `Project` tienen Row-Level Security. Usar siempre `withProjectContext()` para queries sobre datos de tenant.

## Email

**Inbound** (polling cada minuto, no Pub/Sub):
- Busca en Gmail asuntos: `NUEVA APP:`, `NUEVOS REQUISITOS APP:`, `COMENTARIOS A REQUISITOS VERSION EN CURSO:`
- Cada email arranca un `processEmailWorkflow` durable

**Outbound**: Gmail API (OAuth2). No usa Resend.

## Variables de entorno

Ficheros locales necesarios:
- `apps/app/.env.local`
- `apps/api/.env.local`
- `packages/database/.env`

Ver `TODO.md` para referencia completa de variables.

## Crontab del sistema

Dos tareas configuradas en la máquina local (`crontab -l`):

```
# Cada hora: procesa proyectos SOLICITADO → ENTORNO_CONSTRUIDO
0 * * * * .../cron-status-runner.sh >> /tmp/cron-status.log 2>&1

# Cada 4 horas: agentes Claude implementan proyectos ENTORNO_CONSTRUIDO → CODIGO_CREADO
0 */4 * * * .../desarrollar-runner.sh >> /tmp/cron-desarrollar.log 2>&1
```

Ambos runners verifican si la API está corriendo en `:5555` y la levantan si no lo está.
