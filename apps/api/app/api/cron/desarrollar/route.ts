import { database } from "@repo/database";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { type NextRequest, NextResponse } from "next/server";

// Devuelve proyectos en ENTORNO_CONSTRUIDO y los pasa a CREANDO_CODIGO atómicamente.
// Llamado por el script desarrollar_proyectos.sh antes de lanzar los agentes.

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await database.project.findMany({
      where: { status: "ENTORNO_CONSTRUIDO" },
      select: { id: true, code: true, name: true },
    });

    if (projects.length === 0) {
      return NextResponse.json({ projects: [] });
    }

    await database.project.updateMany({
      where: { id: { in: projects.map((p) => p.id) } },
      data: { status: "CREANDO_CODIGO" },
    });

    log.info(`[cron/desarrollar] ${projects.length} proyecto(s) → CREANDO_CODIGO`);

    return NextResponse.json({ projects });
  } catch (error) {
    const message = parseError(error);
    log.error(`[cron/desarrollar] failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
