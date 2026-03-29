-- ============================================================
-- ROW LEVEL SECURITY — Aislamiento por proyecto
--
-- Aplicar DESPUÉS de `prisma migrate deploy` (o db:push) en
-- cada entorno. Este fichero NO es gestionado por Prisma.
--
-- Ejecutar con neondb_owner (tiene BYPASSRLS — aplica DDL):
--   psql $DATABASE_URL -f prisma/rls/001_enable_rls.sql
--
-- Para que el aislamiento sea efectivo, la app debe conectarse
-- como app_user (sin BYPASSRLS). Ver 002_app_user.sql.
-- ============================================================

-- ─── Habilitar RLS en tablas con datos de proyecto ────────
ALTER TABLE "Requirement"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RequirementGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Version"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailLog"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReviewCycle"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmailAttachment"  ENABLE ROW LEVEL SECURITY;

-- ─── Eliminar políticas previas si existen ────────────────
DROP POLICY IF EXISTS project_isolation ON "Requirement";
DROP POLICY IF EXISTS project_isolation ON "RequirementGroup";
DROP POLICY IF EXISTS project_isolation ON "Version";
DROP POLICY IF EXISTS project_isolation ON "EmailLog";
DROP POLICY IF EXISTS project_isolation ON "ReviewCycle";
DROP POLICY IF EXISTS project_isolation ON "EmailAttachment";

-- ─── Políticas de aislamiento ─────────────────────────────
--
-- TO app_user: solo afecta al rol de aplicación.
-- neondb_owner tiene BYPASSRLS → siempre puede leer/escribir todo
-- (necesario para migraciones y operaciones de mantenimiento).
--
-- USING: filtra lecturas y la fila objetivo en UPDATE/DELETE
-- WITH CHECK: valida que las escrituras pertenezcan al proyecto
--
-- La app DEBE llamar withProjectContext(projectId, ...) antes
-- de cualquier query de tenant. Si no se establece contexto,
-- la condición falla y la query devuelve vacío / es rechazada.
-- ─────────────────────────────────────────────────────────

CREATE POLICY project_isolation ON "Requirement"
  FOR ALL TO app_user
  USING (
    "projectId" = current_setting('app.current_project_id', true)
  )
  WITH CHECK (
    "projectId" = current_setting('app.current_project_id', true)
  );

CREATE POLICY project_isolation ON "RequirementGroup"
  FOR ALL TO app_user
  USING (
    "projectId" = current_setting('app.current_project_id', true)
  )
  WITH CHECK (
    "projectId" = current_setting('app.current_project_id', true)
  );

CREATE POLICY project_isolation ON "Version"
  FOR ALL TO app_user
  USING (
    "projectId" = current_setting('app.current_project_id', true)
  )
  WITH CHECK (
    "projectId" = current_setting('app.current_project_id', true)
  );

CREATE POLICY project_isolation ON "EmailLog"
  FOR ALL TO app_user
  USING (
    "projectId" = current_setting('app.current_project_id', true)
  )
  WITH CHECK (
    "projectId" = current_setting('app.current_project_id', true)
  );

CREATE POLICY project_isolation ON "ReviewCycle"
  FOR ALL TO app_user
  USING (
    "projectId" = current_setting('app.current_project_id', true)
  )
  WITH CHECK (
    "projectId" = current_setting('app.current_project_id', true)
  );

-- EmailAttachment: aislamiento vía versionId (no tiene projectId directo)
-- Se accede siempre dentro de withProjectContext que filtra por versionId
-- La policy protege contra accesos directos sin contexto
CREATE POLICY project_isolation ON "EmailAttachment"
  FOR ALL TO app_user
  USING (
    EXISTS (
      SELECT 1 FROM "Version"
      WHERE "Version"."id" = "EmailAttachment"."versionId"
        AND "Version"."projectId" = current_setting('app.current_project_id', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Version"
      WHERE "Version"."id" = "EmailAttachment"."versionId"
        AND "Version"."projectId" = current_setting('app.current_project_id', true)
    )
  );

-- ─── Verificar estado ─────────────────────────────────────
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename IN (
  'Requirement','RequirementGroup','Version',
  'EmailLog','ReviewCycle','EmailAttachment'
);
