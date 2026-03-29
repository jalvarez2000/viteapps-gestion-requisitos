export type EmailType =
  | "NEW_APP"
  | "NEW_REQUIREMENTS"
  | "REQUIREMENT_COMMENTS"
  | "UNKNOWN";

export interface ParsedAttachment {
  attachmentId: string; // Gmail attachment ID — fetch separately
  filename: string;
  mimeType: string;
  size: number;
}

export interface ParsedEmail {
  appName: string | null;
  attachments: ParsedAttachment[];
  body: string;
  clientEmail: string; // Email del cliente extraído del formulario (o from como fallback)
  from: string;
  messageId: string;
  receivedAt: Date;
  subject: string;
  threadId: string;
  type: EmailType;
  userSize: "XS" | "S" | "M" | "L" | "XL" | null; // Talla indicada en el formulario
}
