import { getGmailClient } from "./client";
import { buildParsedEmail } from "./parser";
import type { ParsedEmail } from "./types";

const PROCESSED_LABEL = "PROCESADO_SISTEMA";
const REQUIREMENTS_QUERY = "is:unread";

async function ensureProcessedLabel(
  gmail: ReturnType<typeof getGmailClient>
): Promise<string> {
  const { data } = await gmail.users.labels.list({ userId: "me" });
  const existing = data.labels?.find((l) => l.name === PROCESSED_LABEL);
  if (existing?.id) {
    return existing.id;
  }

  const { data: created } = await gmail.users.labels.create({
    userId: "me",
    requestBody: { name: PROCESSED_LABEL, labelListVisibility: "labelHide" },
  });
  return created.id!;
}

export async function fetchUnreadRequirementsEmails(): Promise<ParsedEmail[]> {
  const gmail = getGmailClient();

  const { data } = await gmail.users.messages.list({
    userId: "me",
    q: REQUIREMENTS_QUERY,
    maxResults: 20,
  });

  if (!data.messages?.length) {
    return [];
  }

  const emails: ParsedEmail[] = [];

  for (const { id } of data.messages) {
    if (!id) {
      continue;
    }

    const { data: msg } = await gmail.users.messages.get({
      userId: "me",
      id,
      format: "full",
    });

    if (!(msg.id && msg.threadId && msg.internalDate && msg.payload)) {
      continue;
    }

    const parsed = buildParsedEmail({
      id: msg.id,
      threadId: msg.threadId,
      internalDate: msg.internalDate,
      payload: msg.payload as Parameters<typeof buildParsedEmail>[0]["payload"],
    });

    // Only process known email types
    if (parsed.type === "UNKNOWN") {
      continue;
    }

    emails.push(parsed);
  }

  return emails;
}

/**
 * Downloads a Gmail attachment and returns its base64-encoded data.
 */
export async function fetchAttachmentData(
  messageId: string,
  attachmentId: string
): Promise<string> {
  const gmail = getGmailClient();
  const { data } = await gmail.users.messages.attachments.get({
    userId: "me",
    messageId,
    id: attachmentId,
  });
  // Gmail returns base64url — normalize to standard base64
  return (data.data ?? "").replace(/-/g, "+").replace(/_/g, "/");
}

export async function markEmailAsProcessed(messageId: string): Promise<void> {
  const gmail = getGmailClient();
  const labelId = await ensureProcessedLabel(gmail);

  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      addLabelIds: [labelId],
      removeLabelIds: ["UNREAD"],
    },
  });
}
