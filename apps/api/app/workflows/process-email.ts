import type { EmailType as DbEmailType } from "@repo/database/generated/enums";
import type { EmailType, ParsedAttachment } from "@repo/gmail";
import { FatalError } from "workflow";

// ─────────────────────────────────────────────────────────────────
// Step functions — full Node.js access, retryable, results cached
// All Node.js-dependent imports (Prisma, Gmail) are dynamic so the
// WDK bundler doesn't try to include them in the workflow scope.
// ─────────────────────────────────────────────────────────────────

async function resolveProject(
  appName: string,
  emailType: EmailType,
  clientEmail: string
) {
  "use step";

  const { database } = await import("@repo/database");

  if (emailType === "NEW_APP") {
    let project = await database.project.findUnique({
      where: { name: appName },
    });
    if (!project) {
      project = await database.project.create({
        data: { name: appName, clientEmail },
      });
    }

    let version = await database.version.findFirst({
      where: { projectId: project.id },
      orderBy: { number: "desc" },
    });
    if (!version) {
      version = await database.version.create({
        data: { projectId: project.id, number: 1, status: "OPEN" },
      });
    }

    return {
      projectId: project.id,
      versionId: version.id,
      projectName: project.name,
      versionNumber: version.number,
      clientEmail: project.clientEmail,
    };
  }

  const project = await database.project.findUnique({
    where: { name: appName },
    include: {
      versions: {
        where: { status: "OPEN" },
        orderBy: { number: "desc" },
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
    projectName: project.name,
    versionNumber: project.versions[0].number,
    clientEmail: project.clientEmail,
  };
}

async function logEmail(params: {
  projectId: string;
  messageId: string;
  threadId: string;
  subject: string;
  fromAddress: string;
  body: string;
  emailType: DbEmailType;
  appName: string;
  receivedAt: Date;
}) {
  "use step";

  const { database } = await import("@repo/database");

  const existing = await database.emailLog.findUnique({
    where: { gmailMessageId: params.messageId },
    select: { id: true },
  });
  if (existing) {
    return existing.id;
  }

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

async function saveAttachments(params: {
  messageId: string;
  emailLogId: string;
  versionId: string;
  attachments: ParsedAttachment[];
}): Promise<string[]> {
  "use step";

  if (!params.attachments.length) {
    return [];
  }

  const { database } = await import("@repo/database");
  const { fetchAttachmentData } = await import("@repo/gmail");

  const savedTexts: string[] = [];

  for (const att of params.attachments) {
    const data = await fetchAttachmentData(params.messageId, att.attachmentId);

    await database.emailAttachment.create({
      data: {
        emailLogId: params.emailLogId,
        versionId: params.versionId,
        filename: att.filename,
        mimeType: att.mimeType,
        size: att.size,
        data,
      },
    });

    if (
      att.mimeType.startsWith("text/") ||
      att.mimeType === "application/json"
    ) {
      const text = Buffer.from(data, "base64").toString("utf-8");
      savedTexts.push(`\n\n--- Adjunto: ${att.filename} ---\n${text}`);
    }
  }

  return savedTexts;
}

async function runExtractionAgent(params: {
  projectId: string;
  versionId: string;
  emailBody: string;
  sourceEmailId: string;
}) {
  "use step";

  const { extractRequirementsFromEmail } = await import("@repo/ai");
  return extractRequirementsFromEmail(params);
}

async function openReviewCycle(projectId: string, versionId: string) {
  "use step";

  const { database } = await import("@repo/database");

  const lastCycle = await database.reviewCycle.findFirst({
    where: { versionId },
    orderBy: { cycleNumber: "desc" },
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

async function sendConfirmation(params: {
  to: string;
  projectId: string;
  versionId: string;
  projectName: string;
  versionNumber: number;
  attachmentCount: number;
}) {
  "use step";

  const { database } = await import("@repo/database");
  const { sendReceptionConfirmation } = await import("@repo/gmail");

  const requirements = await database.requirement.findMany({
    where: { versionId: params.versionId, projectId: params.projectId },
    include: { group: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  await sendReceptionConfirmation({
    to: params.to,
    props: {
      projectName: params.projectName,
      versionNumber: params.versionNumber,
      attachmentCount: params.attachmentCount,
      replySubject: `COMENTARIOS A REQUISITOS VERSION EN CURSO: ${params.projectName}`,
      requirements: requirements.map((r) => ({
        group: r.group.name,
        title: r.title,
        description: r.description,
      })),
    },
  });
}

async function markProcessed(messageId: string) {
  "use step";
  const { markEmailAsProcessed } = await import("@repo/gmail");
  await markEmailAsProcessed(messageId);
}

// ─────────────────────────────────────────────────────────────────
// Main workflow — orchestrates steps, durable across restarts
// ─────────────────────────────────────────────────────────────────

export interface ProcessEmailInput {
  appName: string;
  attachments: ParsedAttachment[];
  body: string;
  clientEmail: string; // Email del cliente extraído del formulario
  emailType: EmailType;
  fromAddress: string;
  messageId: string;
  receivedAt: Date;
  subject: string;
  threadId: string;
}

export async function processEmailWorkflow(input: ProcessEmailInput) {
  "use workflow";

  // 1. Resolve (or create) the project and target version
  const { projectId, versionId, projectName, versionNumber } =
    await resolveProject(input.appName, input.emailType, input.clientEmail);

  // 2. Persist the email for audit trail
  const emailLogId = await logEmail({
    projectId,
    messageId: input.messageId,
    threadId: input.threadId,
    subject: input.subject,
    fromAddress: input.fromAddress,
    body: input.body,
    emailType: input.emailType as DbEmailType,
    appName: input.appName,
    receivedAt: input.receivedAt,
  });

  // 3. Download and save attachments; get text content from text-based files
  const attachmentTexts = await saveAttachments({
    messageId: input.messageId,
    emailLogId,
    versionId,
    attachments: input.attachments,
  });

  // 4. Run the AI agent — include attachment text so it extracts requirements from files too
  const fullBody = input.body + attachmentTexts.join("");
  await runExtractionAgent({
    projectId,
    versionId,
    emailBody: fullBody,
    sourceEmailId: emailLogId,
  });

  // 5. Open a new review cycle so the manager knows there's work to do
  await openReviewCycle(projectId, versionId);

  // 6. Send confirmation email with the extracted requirements table
  await sendConfirmation({
    to: input.clientEmail,
    projectId,
    versionId,
    projectName,
    versionNumber,
    attachmentCount: input.attachments.length,
  });

  // 7. Mark email as processed in Gmail
  await markProcessed(input.messageId);

  return { projectId, versionId };
}
