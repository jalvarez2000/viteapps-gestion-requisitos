# Pendientes de configuración — Gestión de Requisitos

> Última actualización: 2026-03-28
> Estado: entorno local funcionando, falta conectar servicios externos para producción.

---

## 1. Vercel Blob — Backups diarios

**Proyecto afectado:** `gestion-requisitos-api`

El cron `/api/cron/backup` (02:00 UTC) hace `pg_dump` y sube a Vercel Blob.
Necesita `BLOB_READ_WRITE_TOKEN`.

```bash
# Opción A — desde el marketplace de Vercel (recomendado)
vercel integration add vercel-blob --scope jalvarez2000-5936s-projects
# Selecciona el proyecto gestion-requisitos-api
# Vercel añade BLOB_READ_WRITE_TOKEN automáticamente

# Opción B — manual desde dashboard
# https://vercel.com/jalvarez2000-5936s-projects/gestion-requisitos-api/settings/environment-variables
# Variable: BLOB_READ_WRITE_TOKEN
# Valor: vercel_blob_rw_... (se obtiene en Storage → Create Store → Blob)
```

Añadir también a `apps/api/.env.local` para desarrollo:
```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

---

## 2. AI Gateway — OIDC Token

**Proyectos afectados:** `gestion-requisitos-api` (workflows + agente AI)

El agente de requisitos usa `anthropic/claude-sonnet-4.6` vía AI Gateway con OIDC.

```bash
# Habilitar AI Gateway en el dashboard de Vercel:
# https://vercel.com/jalvarez2000-5936s-projects/gestion-requisitos-api/settings → AI Gateway → Enable

# Luego provisionar el token local:
cd apps/api
vercel link  # ya enlazado, solo confirmar
vercel env pull .env.local
# Genera VERCEL_OIDC_TOKEN en .env.local automáticamente
```

El token caduca en ~24h. Renovar con `vercel env pull .env.local --yes` cuando expire.

---

## 3. Gmail OAuth2 — Completar variables en Vercel

**Proyecto afectado:** `gestion-requisitos-api`

Credenciales en Google Cloud Console → proyecto "Gestor Requisitos ViteApps" → Credentials.
Si el refresh token no está guardado, ejecutar `node get-gmail-token.mjs` con las variables de entorno:

```bash
export GMAIL_CLIENT_ID="<ver Google Cloud Console>"
export GMAIL_CLIENT_SECRET="<ver Google Cloud Console>"
node get-gmail-token.mjs
```

Añadir a Vercel (el script `ejecucion/setup-vercel-env.sh` lo hace automáticamente).

Cuenta Gmail: `viteappsbreizh@gmail.com`
Google Cloud Project: `Gestor Requisitos ViteApps`

---

## 4. Deploy a Vercel — Staging + Producción

### 4.1 Crear repositorio GitHub (si no existe)

```bash
gh repo create viteappsbreizh/gestion-requisitos --private --source=. --push
```

### 4.2 Conectar proyectos Vercel al repo

En el dashboard de Vercel, para cada proyecto:
- `gestion-requisitos-app` → Settings → Git → Connect → repo `gestion-requisitos` → Root: `apps/app`
- `gestion-requisitos-api` → Settings → Git → Connect → repo `gestion-requisitos` → Root: `apps/api`

### 4.3 Estrategia de ramas

| Rama git | Vercel target | Base de datos Neon |
|----------|---------------|--------------------|
| `main`    | **production** | branch `production` (ep-nameless-term-alppqd65) |
| `staging` | **preview**    | branch `staging`    (ep-damp-rice-aljp6evx) |
| Otras ramas / PRs | preview | branch `staging` (mismas vars de preview) |

### 4.4 Configurar variables de entorno

**Antes de ejecutar el script, exportar:**

```bash
export DB_STAGING_APP="postgresql://app_user:<PASSWORD>@ep-damp-rice-aljp6evx.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
export DB_PRODUCTION_APP="postgresql://app_user:<PASSWORD>@ep-nameless-term-alppqd65.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
export CLERK_PUBLISHABLE_STAGING="pk_test_..."   # Clerk Dashboard
export CLERK_SECRET_STAGING="sk_test_..."
export CLERK_PUBLISHABLE_PRODUCTION="pk_live_..."
export CLERK_SECRET_PRODUCTION="sk_live_..."
export GMAIL_CLIENT_ID="<Google Cloud Console>"
export GMAIL_CLIENT_SECRET="<Google Cloud Console>"
export GMAIL_REFRESH_TOKEN="<ejecutar get-gmail-token.mjs>"
export CRON_SECRET=$(openssl rand -hex 32)

# Ejecutar:
./ejecucion/setup-vercel-env.sh all
```

### 4.5 Pasos post-script (manuales en Vercel Dashboard)

1. **AI Gateway**: `gestion-requisitos-api` → Settings → AI → Enable
   Luego: `cd apps/api && vercel env pull .env.local` para `VERCEL_OIDC_TOKEN` local
2. **Vercel Blob**: Marketplace → Storage → Create Blob → asociar a `gestion-requisitos-api`

### 4.6 Variables auto-provisionadas por Vercel (no requieren configuración manual)

| Variable | Origen |
|----------|--------|
| `VERCEL_OIDC_TOKEN` | AI Gateway (al habilitarlo) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob Marketplace |
| `VERCEL`, `VERCEL_ENV`, `VERCEL_URL` | Inyectadas en cada build |

---

## 5. Variables de entorno locales — resumen completo

Los valores reales están en: Google Cloud Console, Clerk Dashboard, Neon Console.
**Nunca commitear estos archivos** (están en `.gitignore`).

Crear `apps/api/.env.local`:
```bash
DATABASE_URL="postgresql://neondb_owner:<PASSWORD>@ep-damp-rice-aljp6evx.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
DATABASE_APP_URL="postgresql://app_user:<PASSWORD>@ep-damp-rice-aljp6evx.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
GMAIL_CLIENT_ID="<Google Cloud Console>"
GMAIL_CLIENT_SECRET="<Google Cloud Console>"
GMAIL_REFRESH_TOKEN="<ejecutar get-gmail-token.mjs>"
GMAIL_TARGET_ADDRESS="viteappsbreizh@gmail.com"
CRON_SECRET="<openssl rand -hex 32>"
# VERCEL_OIDC_TOKEN=  # auto: vercel env pull .env.local
# BLOB_READ_WRITE_TOKEN=
```

Crear `apps/app/.env.local`:
```bash
DATABASE_URL="postgresql://neondb_owner:<PASSWORD>@ep-damp-rice-aljp6evx.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
DATABASE_APP_URL="postgresql://app_user:<PASSWORD>@ep-damp-rice-aljp6evx.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"
CLERK_SECRET_KEY="sk_test_..."
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_..."
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
GMAIL_CLIENT_ID="<Google Cloud Console>"
GMAIL_CLIENT_SECRET="<Google Cloud Console>"
GMAIL_REFRESH_TOKEN="<ejecutar get-gmail-token.mjs>"
GMAIL_TARGET_ADDRESS="viteappsbreizh@gmail.com"
PORTAL_SESSION_SECRET="<openssl rand -hex 32>"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NEXT_PUBLIC_WEB_URL="http://localhost:3000"
NEXT_PUBLIC_API_URL="http://localhost:3002"
```

---

## 6. Neon — Referencia de conexiones

| Branch | Host | Uso |
|--------|------|-----|
| production | `ep-nameless-term-alppqd65.c-3.eu-central-1.aws.neon.tech` | PRO (Vercel production) |
| staging | `ep-damp-rice-aljp6evx.c-3.eu-central-1.aws.neon.tech` | PRE (Vercel preview + local) |

Proyecto Neon: `steep-scene-28139500` (org: `org-royal-pine-56607537`)

---

## 7. Referencia de proyectos Vercel

| Proyecto | ID | URL |
|----------|----|-----|
| gestion-requisitos-app | `prj_JlVHg0Gep8wuYT9tjSSMCbenZGXQ` | (pendiente dominio) |
| gestion-requisitos-api | `prj_iodNax7zdkXHPu1aszKA1aXMeVXW` | (pendiente dominio) |

Team/scope: `jalvarez2000-5936s-projects`
