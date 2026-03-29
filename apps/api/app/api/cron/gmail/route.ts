import {
  fetchUnreadRequirementsEmails,
  markEmailAsProcessed,
} from "@repo/gmail";
import { parseError } from "@repo/observability/error";
import { log } from "@repo/observability/log";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { processEmailWorkflow } from "@/app/workflows/process-email";

// Vercel Cron: every minute
// vercel.json: { "path": "/api/cron/gmail", "schedule": "* * * * *" }
// Vercel injects the CRON_SECRET Authorization header automatically.

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const emails = await fetchUnreadRequirementsEmails();
    log.info(`[cron/gmail] fetched ${emails.length} unread email(s)`);

    if (!emails.length) {
      return NextResponse.json({ processed: 0 });
    }

    // Mark as read immediately — before starting workflows — so the next
    // cron run doesn't pick them up again while workflows are still running.
    await Promise.all(
      emails.map((email) => markEmailAsProcessed(email.messageId))
    );
    log.info(`[cron/gmail] marked ${emails.length} email(s) as read`);

    const runs = await Promise.all(
      emails.map((email) =>
        start(processEmailWorkflow, [
          {
            appName: email.appName ?? email.from,
            attachments: email.attachments,
            body: email.body,
            clientEmail: email.clientEmail,
            emailType: email.type,
            fromAddress: email.from,
            messageId: email.messageId,
            receivedAt: email.receivedAt,
            subject: email.subject,
            threadId: email.threadId,
          },
        ])
      )
    );

    log.info(`[cron/gmail] started ${runs.length} workflow run(s)`, {
      runIds: runs.map((r) => r.runId),
    });

    return NextResponse.json({
      processed: runs.length,
      runIds: runs.map((r) => r.runId),
    });
  } catch (error) {
    const message = parseError(error);
    log.error(`[cron/gmail] failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
