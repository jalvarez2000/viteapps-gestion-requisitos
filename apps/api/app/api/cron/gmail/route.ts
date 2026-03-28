import { fetchUnreadRequirementsEmails } from '@repo/gmail';
import { log } from '@repo/observability/log';
import { parseError } from '@repo/observability/error';
import { start } from 'workflow/api';
import { NextRequest, NextResponse } from 'next/server';
import { processEmailWorkflow } from '@/app/workflows/process-email';

// Vercel Cron: every minute
// vercel.json: { "path": "/api/cron/gmail", "schedule": "* * * * *" }
// Vercel injects the CRON_SECRET Authorization header automatically.

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const emails = await fetchUnreadRequirementsEmails();
    log.info(`[cron/gmail] fetched ${emails.length} unread email(s)`);

    if (!emails.length) {
      return NextResponse.json({ processed: 0 });
    }

    const runs = await Promise.all(
      emails.map((email) =>
        start(processEmailWorkflow, [
          {
            messageId: email.messageId,
            threadId: email.threadId,
            subject: email.subject,
            fromAddress: email.from,
            body: email.body,
            emailType: email.type,
            appName: email.appName!,
            receivedAt: email.receivedAt,
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
