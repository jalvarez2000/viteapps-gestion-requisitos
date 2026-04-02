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

console.log("[cron/projects-status] cwd:", process.cwd());
console.log("[cron/projects-status] SCRIPT_PATH:", SCRIPT_PATH);

async function writeRequirementsFile(projectId: string, projectCode: string, projectName: string) {
  const [versions, emailComments] = await Promise.all([
    withProjectContext(projectId, (tx) =>
      tx.version.findMany({
        where: { projectId },
        orderBy: { number: "asc" },
        include: {
          groups: {
            orderBy: { name: "asc" },
            include: {
              requirements: { orderBy: { createdAt: "asc" } },
            },
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

  for (const version of versions) {
    const statusLabel: Record<string, string> = {
      OPEN: "Abierta",
      FROZEN: "Congelada",
      TAGGED: "Publicada",
    };
    lines.push(`${"=".repeat(60)}`);
    lines.push(`VERSIÓN ${version.number} — ${statusLabel[version.status] ?? version.status}`);
    lines.push(`${"=".repeat(60)}`);
    lines.push("");

    for (const group of version.groups) {
      lines.push(`## ${group.name}`);
      if (group.description) {
        lines.push(group.description);
      }
      lines.push("");

      for (const req of group.requirements) {
        const statusReq: Record<string, string> = {
          PENDING: "Pendiente",
          CONFIRMED: "Confirmado",
          NOT_IMPLEMENTABLE: "No implementable",
        };
        lines.push(`### ${req.title}`);
        lines.push(req.description);
        lines.push(`Estado: ${statusReq[req.status] ?? req.status}`);
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

  if (emailComments.length > 0) {
    lines.push(`${"=".repeat(60)}`);
    lines.push("COMENTARIOS DEL CLIENTE");
    lines.push(`${"=".repeat(60)}`);
    lines.push("");
    for (const c of emailComments) {
      lines.push(`[${c.requirement.title}] (${c.author}) ${c.body}`);
    }
    lines.push("");
  }

  const destDir = path.join(REPO_ROOT, "viteapps-projects", projectCode, "requirements");
  mkdirSync(destDir, { recursive: true });
  writeFileSync(path.join(destDir, "USER_REQUIREMENTS.txt"), lines.join("\n"), "utf-8");
  log.info(`[cron/projects-status] requirements escritos en ${destDir}/USER_REQUIREMENTS.txt`);
}

async function processProject(project: { id: string; code: string; name: string }) {
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

  await writeRequirementsFile(project.id, project.code, project.name);

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
      select: { id: true, code: true, name: true },
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
