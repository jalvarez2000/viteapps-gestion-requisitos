import { database } from "@repo/database";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { type NextRequest, NextResponse } from "next/server";

// Body: { runId: string }
// Response: { id: string }

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { runId } = (await req.json()) as { runId: string };

    const cronLog = await database.cronLog.update({
      where: { id: runId },
      data: { finishedAt: new Date() },
    });

    log.info(`[cron/log/finish] run=${runId} finished`);
    return NextResponse.json({ id: cronLog.id });
  } catch (error) {
    const message = parseError(error);
    log.error(`[cron/log/finish] failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
