import type {
  PasswordResetEmailProps,
  ReceptionConfirmationEmailProps,
  VersionSummaryEmailProps,
} from "@repo/email";
import {
  renderPasswordReset,
  renderReceptionConfirmation,
  renderVersionSummary,
} from "@repo/email";
import { getGmailClient } from "./client";
import { keys } from "./keys";

function encodeSubject(subject: string): string {
  // RFC 2047 encoded-word: required for non-ASCII characters in email headers
  return `=?utf-8?B?${Buffer.from(subject).toString("base64")}?=`;
}

function buildRawEmail({
  from,
  to,
  subject,
  html,
}: {
  from: string;
  to: string;
  subject: string;
  html: string;
}): string {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeSubject(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=utf-8",
    "",
    html,
  ].join("\r\n");

  // Gmail API requires base64url encoding
  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendPasswordReset(params: {
  to: string;
  props: PasswordResetEmailProps;
}): Promise<void> {
  const { GMAIL_TARGET_ADDRESS } = keys();
  const gmail = getGmailClient();

  const { html, subject } = await renderPasswordReset(params.props);

  const raw = buildRawEmail({
    from: GMAIL_TARGET_ADDRESS,
    to: params.to,
    subject,
    html,
  });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}

export async function sendVersionSummary(params: {
  to: string;
  props: VersionSummaryEmailProps;
}): Promise<void> {
  const { GMAIL_TARGET_ADDRESS } = keys();
  const gmail = getGmailClient();

  const { html, subject } = await renderVersionSummary(params.props);

  const raw = buildRawEmail({
    from: GMAIL_TARGET_ADDRESS,
    to: params.to,
    subject,
    html,
  });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}

export async function sendReceptionConfirmation(params: {
  to: string;
  props: ReceptionConfirmationEmailProps;
}): Promise<void> {
  const { GMAIL_TARGET_ADDRESS } = keys();
  const gmail = getGmailClient();

  const { html, subject } = await renderReceptionConfirmation(params.props);

  const raw = buildRawEmail({
    from: GMAIL_TARGET_ADDRESS,
    to: params.to,
    subject,
    html,
  });

  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
}
