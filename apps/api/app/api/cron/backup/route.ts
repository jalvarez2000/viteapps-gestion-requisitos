import { log } from '@repo/observability/log';
import { parseError } from '@repo/observability/error';
import { put } from '@vercel/blob';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { NextRequest, NextResponse } from 'next/server';

// Daily backup at 02:00 UTC — vercel.json schedule: "0 2 * * *"
// Dumps the Neon DB and stores it in Vercel Blob with 30-day retention.
// Neon PITR (Point-in-Time Recovery) provides additional coverage.

const execAsync = promisify(exec);

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL not set');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.sql`;

    log.info(`[cron/backup] starting dump → ${filename}`);

    // pg_dump is available in Vercel's Node.js runtime via PATH
    const { stdout } = await execAsync(`pg_dump "${databaseUrl}" --no-password`);

    const blob = await put(`backups/${filename}`, stdout, {
      access: 'private',
      contentType: 'application/sql',
    });

    // Clean up blobs older than 30 days
    await pruneOldBackups();

    log.info(`[cron/backup] uploaded to Blob: ${blob.url}`);
    return NextResponse.json({ ok: true, filename, url: blob.url });
  } catch (error) {
    const message = parseError(error);
    log.error(`[cron/backup] failed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function pruneOldBackups() {
  const { list, del } = await import('@vercel/blob');
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const { blobs } = await list({ prefix: 'backups/' });
  const old = blobs.filter((b) => new Date(b.uploadedAt) < cutoff);

  if (old.length) {
    await del(old.map((b) => b.url));
    log.info(`[cron/backup] pruned ${old.length} old backup(s)`);
  }
}
