import { database } from "@repo/database";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { type NextRequest, NextResponse } from "next/server";

// Actualiza el estado final de un proyecto tras el desarrollo.
// Body: { id: string, success: boolean }

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id, success } = (await req.json()) as { id: string; success: boolean };

    const status = success ? "CODIGO_CREADO" : "CREANDO_CODIGO";
    await database.project.update({
      where: { id },
      data: { status },
    });

    log.info(`[cron/desarrollar/complete] proyecto ${id} → ${status}`);
    return NextResponse.json({ id, status });
  } catch (error) {
    const message = parseError(error);
    log.error(`[cron/desarrollar/complete] failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
