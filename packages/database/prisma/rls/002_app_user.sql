-- ============================================================
-- ROL DE APLICACIÓN — app_user
--
-- Crea un usuario PostgreSQL sin BYPASSRLS para que la app
-- nunca pueda saltarse las políticas de Row Level Security.
--
-- Uso:
--   Reemplaza {APP_USER_PASSWORD} por una contraseña segura
--   antes de ejecutar:
--
--   psql $DATABASE_URL -f prisma/rls/002_app_user.sql
--
-- Después añade a los .env de la app:
--   DATABASE_APP_URL="postgresql://app_user:{password}@<mismo-host>/neondb?sslmode=require"
-- ============================================================

-- ─── Crear rol ────────────────────────────────────────────
-- NOINHERIT: no hereda permisos de otros roles
-- Sin SUPERUSER, CREATEDB, CREATEROLE ni BYPASSRLS
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN PASSWORD '{APP_USER_PASSWORD}' NOINHERIT;
  END IF;
END $$;

-- ─── Permisos de esquema ──────────────────────────────────
GRANT USAGE ON SCHEMA public TO app_user;

-- ─── Permisos de tablas (solo DML, nunca DDL) ─────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;

-- Tablas futuras (creadas con db:push o migrate)
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;

-- ─── Secuencias (necesarias para los ids auto-generados) ──
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- ─── Verificar ────────────────────────────────────────────
SELECT rolname, rolsuper, rolbypassrls, rolcreatedb
FROM pg_roles
WHERE rolname = 'app_user';
