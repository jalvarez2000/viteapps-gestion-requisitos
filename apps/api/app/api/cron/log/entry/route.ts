import { database } from "@repo/database";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { type NextRequest, NextResponse } from "next/server";

// Body: { runId: string, projectCode: string, status: "OK" | "ERROR", log?: string }
// Response: { id: string }

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { runId, projectCode, status, log: entryLog } = (await req.json()) as {
      runId: string;
      projectCode: string;
      status: string;
      log?: string;
    };

    const entry = await database.cronLogEntry.create({
      data: { cronLogId: runId, projectCode, status, log: entryLog },
    });

    log.info(`[cron/log/entry] run=${runId} project=${projectCode} status=${status}`);
    return NextResponse.json({ id: entry.id });
  } catch (error) {
    const message = parseError(error);
    log.error(`[cron/log/entry] failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
