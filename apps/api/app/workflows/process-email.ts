import { extractRequirementsFromEmail } from '@repo/ai';
import { database } from '@repo/database';
import { markEmailAsProcessed } from '@repo/gmail';
import type { EmailType } from '@repo/gmail';
import { FatalError } from 'workflow';

// ─────────────────────────────────────────────────────────────────
// Step functions — full Node.js access, retryable, results cached
// ─────────────────────────────────────────────────────────────────

async function resolveProject(appName: string, emailType: EmailType, fromAddress: string) {
  'use step';

  if (emailType === 'NEW_APP') {
    // Create project + initial version v1
    const project = await database.project.create({
      data: {
        name: appName,
        clientEmail: fromAddress,
        versions: {
          create: { number: 1, status: 'OPEN' },
        },
      },
      include: { versions: true },
    });

    return {
      projectId: project.id,
      versionId: project.versions[0].id,
      isNew: true,
    };
  }

  // NEW_REQUIREMENTS or REQUIREMENT_COMMENTS — find existing project
  const project = await database.project.findUnique({
    where: { name: appName },
    include: {
      versions: {
        where: { status: 'OPEN' },
        orderBy: { number: 'desc' },
        take: 1,
      },
    },
  });

  if (!project) {
    throw new FatalError(
      `Project "${appName}" not found. Create it first with "NUEVA APP: ${appName}"`
    );
  }

  if (!project.versions[0]) {
    throw new FatalError(
      `Project "${appName}" has no open version. All versions are frozen or tagged.`
    );
  }

  return {
    projectId: project.id,
    versionId: project.versions[0].id,
    isNew: false,
  };
}

async function logEmail(params: {
  projectId: string;
  messageId: string;
  threadId: string;
  subject: string;
  fromAddress: string;
  body: string;
  emailType: EmailType;
  appName: string;
  receivedAt: Date;
}) {
  'use step';

  const log = await database.emailLog.create({
    data: {
      projectId: params.projectId,
      gmailMessageId: params.messageId,
      gmailThreadId: params.threadId,
      subject: params.subject,
      fromAddress: params.fromAddress,
      body: params.body,
      emailType: params.emailType,
      appName: params.appName,
      receivedAt: params.receivedAt,
    },
    select: { id: true },
  });

  return log.id;
}

async function runExtractionAgent(params: {
  projectId: string;
  versionId: string;
  emailBody: string;
  sourceEmailId: string;
}) {
  'use step';

  return extractRequirementsFromEmail(params);
}

async function openReviewCycle(projectId: string, versionId: string) {
  'use step';

  // Get current cycle number for this version
  const lastCycle = await database.reviewCycle.findFirst({
    where: { versionId },
    orderBy: { cycleNumber: 'desc' },
    select: { cycleNumber: true },
  });

  await database.reviewCycle.create({
    data: {
      projectId,
      versionId,
      cycleNumber: (lastCycle?.cycleNumber ?? 0) + 1,
    },
  });
}

async function markProcessed(messageId: string) {
  'use step';
  await markEmailAsProcessed(messageId);
}

// ─────────────────────────────────────────────────────────────────
// Main workflow — orchestrates steps, durable across restarts
// ─────────────────────────────────────────────────────────────────

export interface ProcessEmailInput {
  messageId: string;
  threadId: string;
  subject: string;
  fromAddress: string;
  body: string;
  emailType: EmailType;
  appName: string;
  receivedAt: Date;
}

export async function processEmailWorkflow(input: ProcessEmailInput) {
  'use workflow';

  // 1. Resolve (or create) the project and target version
  const { projectId, versionId } = await resolveProject(
    input.appName,
    input.emailType,
    input.fromAddress
  );

  // 2. Persist the email for audit trail
  const emailLogId = await logEmail({
    projectId,
    messageId: input.messageId,
    threadId: input.threadId,
    subject: input.subject,
    fromAddress: input.fromAddress,
    body: input.body,
    emailType: input.emailType,
    appName: input.appName,
    receivedAt: input.receivedAt,
  });

  // 3. Run the AI agent to extract and persist requirements
  await runExtractionAgent({
    projectId,
    versionId,
    emailBody: input.body,
    sourceEmailId: emailLogId,
  });

  // 4. Open a new review cycle so the manager knows there's work to do
  await openReviewCycle(projectId, versionId);

  // 5. Mark email as processed in Gmail
  await markProcessed(input.messageId);

  return { projectId, versionId };
}
