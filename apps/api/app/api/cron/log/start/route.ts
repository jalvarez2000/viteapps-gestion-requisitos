import { database } from "@repo/database";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { type NextRequest, NextResponse } from "next/server";

// Body: { runner: string }
// Response: { id: string }

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { runner } = (await req.json()) as { runner: string };

    const cronLog = await database.cronLog.create({
      data: { runner },
    });

    log.info(`[cron/log/start] runner=${runner} id=${cronLog.id}`);
    return NextResponse.json({ id: cronLog.id });
  } catch (error) {
    const message = parseError(error);
    log.error(`[cron/log/start] failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
