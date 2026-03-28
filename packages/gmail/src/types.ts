export type EmailType =
  | 'NEW_APP'
  | 'NEW_REQUIREMENTS'
  | 'REQUIREMENT_COMMENTS'
  | 'UNKNOWN';

export interface ParsedEmail {
  messageId: string;
  threadId: string;
  subject: string;
  from: string;
  body: string;
  receivedAt: Date;
  type: EmailType;
  appName: string | null;
}
