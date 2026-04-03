import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { database, withProjectContext } from "@repo/database";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { type NextRequest, NextResponse } from "next/server";

// Vercel Cron: every hour
// vercel.json: { "path": "/api/cron/projects-status", "schedule": "0 * * * *" }

export const maxDuration = 60;

const REPO_ROOT = path.resolve(process.cwd(), "../..");
const SCRIPT_PATH = path.join(REPO_ROOT, "scripts/creacion/clonar_repositorio.sh");
const COMMIT_SCRIPT_PATH = path.join(REPO_ROOT, "scripts/creacion/commit_inicial.sh");

console.log("[cron/projects-status] cwd:", process.cwd());
console.log("[cron/projects-status] SCRIPT_PATH:", SCRIPT_PATH);

const PREAMBLE_MARKER = "## INSTRUCCIONES PARA EL AGENTE DE DESARROLLO";

const SIZE_DESCRIPTIONS: Record<string, string> = {
  XS: "Aplicación muy pequeña (3-5 pantallas). Implementa únicamente la funcionalidad esencial y mínima viable. Sin extras.",
  S:  "Aplicación pequeña (5-10 pantallas). Funcionalidades core bien definidas, UX sencilla, sin módulos avanzados.",
  M:  "Aplicación mediana (10-20 pantallas). Funcionalidades completas, navegación estructurada, alguna complejidad de negocio.",
  L:  "Aplicación grande (20-40 pantallas). Múltiples módulos, funcionalidades avanzadas, gestión de estado compleja.",
  XL: "Aplicación muy grande (40+ pantallas). Sistema complejo con múltiples integraciones, roles, y flujos avanzados.",
};

function buildPreamble(userSize: string | null): string[] {
  const sizeInfo = userSize ? SIZE_DESCRIPTIONS[userSize] : null;
  const lines: string[] = [];

  lines.push(PREAMBLE_MARKER);
  lines.push("");
  lines.push("Antes de implementar, ten en cuenta las siguientes instrucciones:");
  lines.push("");

  if (sizeInfo) {
    lines.push(`### Talla del proyecto: ${userSize}`);
    lines.push(sizeInfo);
    lines.push("Ajusta el alcance de cada requisito a esta talla. No implementes funcionalidades");
    lines.push("más allá de lo que corresponde a este tamaño de aplicación.");
  } else {
    lines.push("### Talla del proyecto: no especificada");
    lines.push("Infiere el alcance adecuado a partir del número y complejidad de los requisitos.");
  }

  lines.push("");
  lines.push("### Requisitos incompletos o ausentes");
  lines.push("Si algún requisito es vago, incompleto o faltan funcionalidades obvias para este");
  lines.push("tipo de aplicación, complétalos con criterio propio basándote en lo que ofrecen");
  lines.push("aplicaciones similares del mercado. Documenta cualquier decisión tomada.");
  lines.push("");
  lines.push("=".repeat(60));
  lines.push("");

  return lines;
}

const STATUS_LABEL: Record<string, string> = { OPEN: "Abierta", FROZEN: "Congelada", TAGGED: "Publicada" };
const STATUS_REQ: Record<string, string> = { PENDING: "Pendiente", CONFIRMED: "Confirmado", NOT_IMPLEMENTABLE: "No implementable" };

interface RequirementItem {
  description: string;
  reviewComment: string | null;
  status: string;
  title: string;
}

interface GroupItem {
  description: string | null;
  name: string;
  requirements: RequirementItem[];
}

interface VersionItem {
  comments: Array<{ body: string }>;
  groups: GroupItem[];
  number: number;
  status: string;
}

interface PortalCommentItem {
  author: string;
  body: string;
  requirement: { title: string };
}

function buildVersionsLines(versions: VersionItem[]): string[] {
  const lines: string[] = [];
  for (const version of versions) {
    lines.push("=".repeat(60));
    lines.push(`VERSIÓN ${version.number} — ${STATUS_LABEL[version.status] ?? version.status}`);
    lines.push("=".repeat(60));
    lines.push("");
    for (const group of version.groups) {
      lines.push(`## ${group.name}`);
      if (group.description) {
        lines.push(group.description);
      }
      lines.push("");
      for (const req of group.requirements) {
        lines.push(`### ${req.title}`);
        lines.push(req.description);
        lines.push(`Estado: ${STATUS_REQ[req.status] ?? req.status}`);
        if (req.reviewComment) {
          lines.push(`Comentario de revisión: ${req.reviewComment}`);
        }
        lines.push("");
      }
    }
    if (version.comments.length > 0) {
      lines.push("--- Observaciones del email ---");
      for (const c of version.comments) {
        lines.push(`- ${c.body}`);
      }
      lines.push("");
    }
  }
  return lines;
}

function buildPortalCommentsLines(portalComments: PortalCommentItem[]): string[] {
  if (portalComments.length === 0) {
    return [];
  }
  const lines: string[] = [];
  lines.push("=".repeat(60));
  lines.push("COMENTARIOS DEL CLIENTE");
  lines.push("=".repeat(60));
  lines.push("");
  for (const c of portalComments) {
    lines.push(`[${c.requirement.title}] (${c.author}) ${c.body}`);
  }
  lines.push("");
  return lines;
}

async function writeRequirementsFile(
  projectId: string,
  projectCode: string,
  projectName: string,
  userSize: string | null
) {
  const [versions, portalComments] = await Promise.all([
    withProjectContext(projectId, (tx) =>
      tx.version.findMany({
        where: { projectId },
        orderBy: { number: "asc" },
        include: {
          groups: {
            orderBy: { name: "asc" },
            include: { requirements: { orderBy: { createdAt: "asc" } } },
          },
          comments: { orderBy: { createdAt: "asc" } },
        },
      })
    ),
    withProjectContext(projectId, (tx) =>
      tx.portalComment.findMany({
        where: { projectId },
        orderBy: { createdAt: "asc" },
        include: { requirement: { select: { title: true } } },
      })
    ),
  ]);

  const lines: string[] = [];
  lines.push(`# Requisitos del proyecto ${projectCode} — ${projectName}`);
  lines.push(`Generado: ${new Date().toISOString()}`);
  lines.push("");

  // Preamble — only added once (guard against duplicates)
  if (!lines.includes(PREAMBLE_MARKER)) {
    lines.push(...buildPreamble(userSize));
  }

  lines.push(...buildVersionsLines(versions));
  lines.push(...buildPortalCommentsLines(portalComments));

  const destDir = path.join(REPO_ROOT, "viteapps-projects", projectCode, "requirements");
  mkdirSync(destDir, { recursive: true });
  writeFileSync(path.join(destDir, "USER_REQUIREMENTS.txt"), lines.join("\n"), "utf-8");
  log.info(`[cron/projects-status] requirements escritos en ${destDir}/USER_REQUIREMENTS.txt`);
}

async function processProject(project: { id: string; code: string; name: string; userSize: string | null }) {
  await database.project.update({
    where: { id: project.id },
    data: { status: "CREANDO_ENTORNO" },
  });
  log.info(`[cron/projects-status] ${project.code} → CREANDO_ENTORNO`);

  const cmd = `bash "${SCRIPT_PATH}" "${project.code}"`;
  console.log("[cron/projects-status] ejecutando:", cmd);
  const output = execSync(cmd, {
    encoding: "utf-8",
    stdio: ["inherit", "pipe", "pipe"],
  });
  if (output) {
    log.info(`[cron/projects-status] script output: ${output.trim()}`);
  }

  await writeRequirementsFile(project.id, project.code, project.name, project.userSize);

  const commitOutput = execSync(`bash "${COMMIT_SCRIPT_PATH}" "${project.code}"`, {
    encoding: "utf-8",
    stdio: ["inherit", "pipe", "pipe"],
  });
  if (commitOutput) {
    log.info(`[cron/projects-status] commit inicial: ${commitOutput.trim()}`);
  }

  await database.project.update({
    where: { id: project.id },
    data: { status: "ENTORNO_CONSTRUIDO" },
  });
  log.info(`[cron/projects-status] ${project.code} → ENTORNO_CONSTRUIDO`);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await database.project.findMany({
      where: { status: "SOLICITADO" },
      select: { id: true, code: true, name: true, userSize: true },
    });

    log.info(`[cron/projects-status] ${projects.length} proyecto(s) en SOLICITADO`);

    const results: { code: string; status: string; error?: string }[] = [];

    for (const project of projects) {
      log.info(`[cron/projects-status] procesando ${project.code} — ${project.name}`);
      try {
        await processProject(project);
        results.push({ code: project.code, status: "ENTORNO_CONSTRUIDO" });
      } catch (scriptError: unknown) {
        const err = scriptError as { stdout?: string; stderr?: string };
        const detail = err.stderr?.trim() || err.stdout?.trim() || parseError(scriptError);
        log.error(`[cron/projects-status] error en ${project.code}: ${detail}`);
        results.push({ code: project.code, status: "CREANDO_ENTORNO", error: detail });
      }
    }

    return NextResponse.json({ processed: projects.length, results });
  } catch (error) {
    const message = parseError(error);
    log.error(`[cron/projects-status] failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
