-- ============================================================
-- ROW LEVEL SECURITY — Aislamiento por proyecto
--
-- Aplicar DESPUÉS de `prisma migrate deploy` en cada entorno.
-- Este fichero NO es gestionado por Prisma Migrate.
-- Ejecutar con: psql $DATABASE_URL -f prisma/rls/001_enable_rls.sql
-- ============================================================

-- Habilitar RLS en tablas con datos de proyecto
ALTER TABLE "Requirement"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RequirementGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Version"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailLog"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReviewCycle"      ENABLE ROW LEVEL SECURITY;

-- Project y enums no necesitan RLS (Project es la raíz, la app controla el acceso)

-- ─────────────────────────────────────────────────────────
-- POLICIES: solo acceso a filas del proyecto en contexto
-- La app establece: SET LOCAL app.current_project_id = '<uuid>'
-- dentro de cada transacción antes de ejecutar queries.
-- ─────────────────────────────────────────────────────────

-- Cuando no hay contexto (migraciones, backups) usamos BYPASSRLS
-- o la variable queda vacía — la policy permite acceso total al owner.

CREATE POLICY project_isolation ON "Requirement"
  USING (
    current_setting('app.current_project_id', true) = ''
    OR current_setting('app.current_project_id', true) IS NULL
    OR "projectId" = current_setting('app.current_project_id', true)
  );

CREATE POLICY project_isolation ON "RequirementGroup"
  USING (
    current_setting('app.current_project_id', true) = ''
    OR current_setting('app.current_project_id', true) IS NULL
    OR "projectId" = current_setting('app.current_project_id', true)
  );

CREATE POLICY project_isolation ON "Version"
  USING (
    current_setting('app.current_project_id', true) = ''
    OR current_setting('app.current_project_id', true) IS NULL
    OR "projectId" = current_setting('app.current_project_id', true)
  );

CREATE POLICY project_isolation ON "EmailLog"
  USING (
    current_setting('app.current_project_id', true) = ''
    OR current_setting('app.current_project_id', true) IS NULL
    OR "projectId" = current_setting('app.current_project_id', true)
  );

CREATE POLICY project_isolation ON "ReviewCycle"
  USING (
    current_setting('app.current_project_id', true) = ''
    OR current_setting('app.current_project_id', true) IS NULL
    OR "projectId" = current_setting('app.current_project_id', true)
  );

-- ─────────────────────────────────────────────────────────
-- Verificar estado
-- ─────────────────────────────────────────────────────────
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('Requirement','RequirementGroup','Version','EmailLog','ReviewCycle');
