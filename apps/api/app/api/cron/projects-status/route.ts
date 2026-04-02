import { database } from "@repo/database";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { type NextRequest, NextResponse } from "next/server";

// Vercel Cron: every hour
// vercel.json: { "path": "/api/cron/projects-status", "schedule": "0 * * * *" }

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await database.project.findMany({
      where: { status: "SOLICITADO" },
      select: { id: true, code: true, name: true, clientEmail: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    log.info(
      `[cron/projects-status] ${projects.length} proyecto(s) en estado SOLICITADO`
    );
    for (const p of projects) {
      log.info("[cron/projects-status] proyecto pendiente", {
        code: p.code,
        name: p.name,
        clientEmail: p.clientEmail,
        createdAt: p.createdAt.toISOString(),
      });
    }

    return NextResponse.json({ solicitado: projects.length, projects });
  } catch (error) {
    const message = parseError(error);
    log.error(`[cron/projects-status] failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
