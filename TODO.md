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

Las credenciales de Gmail ya están obtenidas (script `get-gmail-token.mjs` ejecutado).
Añadir a Vercel producción y preview:

```bash
cd apps/api

vercel env add GMAIL_CLIENT_ID production --value "GMAIL_CLIENT_ID_PLACEHOLDER" --yes
vercel env add GMAIL_CLIENT_SECRET production --value "GMAIL_CLIENT_SECRET_PLACEHOLDER" --sensitive --yes
vercel env add GMAIL_REFRESH_TOKEN production --value "<EL_REFRESH_TOKEN_OBTENIDO>" --sensitive --yes
```

> ⚠️ El refresh token se obtuvo al ejecutar `get-gmail-token.mjs`. Si no se guardó,
> revocar acceso en https://myaccount.google.com/permissions y ejecutar el script de nuevo.

Cuenta Gmail: `viteappsbreizh@gmail.com`
Google Cloud Project: `Gestor Requisitos ViteApps`
Client ID: `GMAIL_CLIENT_ID_PLACEHOLDER`

---

## 4. GitHub + Deploy a Vercel

### 4.1 Crear repositorio GitHub

```bash
cd /Users/javier/Desktop/Personal/viteapps-projects/gestionRequisitos/gestion-requisitos

# Crear repo privado y hacer push
gh repo create viteappsbreizh/gestion-requisitos --private --source=. --push
```

### 4.2 Conectar proyectos Vercel al repo

En el dashboard de Vercel, para cada proyecto:
- `gestion-requisitos-app` → Settings → Git → Connect → repo `gestion-requisitos` → Root: `apps/app`
- `gestion-requisitos-api` → Settings → Git → Connect → repo `gestion-requisitos` → Root: `apps/api`

### 4.3 Configurar Root Directory en Vercel

Cada proyecto Vercel debe tener su `Root Directory` configurado:

| Proyecto Vercel | Root Directory |
|-----------------|----------------|
| gestion-requisitos-app | `apps/app` |
| gestion-requisitos-api | `apps/api` |

---

## 5. Variables de entorno locales — resumen completo

Crear `apps/api/.env.local`:
```bash
# Base de datos (staging para desarrollo)
DATABASE_URL="postgresql://neondb_owner:NEON_PASSWORD_PLACEHOLDER@ep-damp-rice-aljp6evx.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"

# Auth (Clerk — test keys)
CLERK_SECRET_KEY="CLERK_SECRET_KEY_PLACEHOLDER"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="CLERK_PUBLISHABLE_KEY_PLACEHOLDER"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# Gmail
GMAIL_CLIENT_ID="GMAIL_CLIENT_ID_PLACEHOLDER"
GMAIL_CLIENT_SECRET="GMAIL_CLIENT_SECRET_PLACEHOLDER"
GMAIL_REFRESH_TOKEN="<COMPLETAR>"
GMAIL_TARGET_ADDRESS="viteappsbreizh@gmail.com"

# Cron
CRON_SECRET="CRON_SECRET_PLACEHOLDER"

# AI Gateway (ejecutar: vercel env pull .env.local)
# VERCEL_OIDC_TOKEN=  # auto-provisioned por vercel env pull

# Blob (pendiente)
# BLOB_READ_WRITE_TOKEN=
```

Crear `apps/app/.env.local`:
```bash
# Base de datos (staging para desarrollo)
DATABASE_URL="postgresql://neondb_owner:NEON_PASSWORD_PLACEHOLDER@ep-damp-rice-aljp6evx.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require"

# Auth (Clerk — test keys)
CLERK_SECRET_KEY="CLERK_SECRET_KEY_PLACEHOLDER"
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="CLERK_PUBLISHABLE_KEY_PLACEHOLDER"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"

# Gmail (para envío de emails desde completeReview)
GMAIL_CLIENT_ID="GMAIL_CLIENT_ID_PLACEHOLDER"
GMAIL_CLIENT_SECRET="GMAIL_CLIENT_SECRET_PLACEHOLDER"
GMAIL_REFRESH_TOKEN="<COMPLETAR>"
GMAIL_TARGET_ADDRESS="viteappsbreizh@gmail.com"
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
