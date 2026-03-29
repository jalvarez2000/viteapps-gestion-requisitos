import type { EmailType, ParsedAttachment, ParsedEmail } from "./types";

// Patterns:
//   NUEVA APP: XXXXXX
//   NUEVOS REQUISITOS APP: XXXXXX
//   COMENTARIOS A REQUISITOS VERSION EN CURSO: XXXXXX
const PATTERNS: { type: EmailType; regex: RegExp }[] = [
  {
    type: "NEW_APP",
    regex: /^NUEVA\s+APP\s*:\s*(.+)$/i,
  },
  {
    type: "NEW_APP",
    regex: /^\[ViteApps\]\s+Nouvelle\s+demande(.*)/i,
  },
  {
    type: "NEW_REQUIREMENTS",
    regex: /^NUEVOS\s+REQUISITOS\s+APP\s*:\s*(.+)$/i,
  },
  {
    type: "REQUIREMENT_COMMENTS",
    regex: /^COMENTARIOS\s+A\s+REQUISITOS\s+VERSION\s+EN\s+CURSO\s*:\s*(.+)$/i,
  },
];

export function parseSubject(subject: string): {
  type: EmailType;
  appName: string | null;
} {
  const cleaned = subject.trim();

  for (const { type, regex } of PATTERNS) {
    const match = cleaned.match(regex);
    if (match) {
      return { type, appName: match[1].trim() };
    }
  }

  return { type: "UNKNOWN", appName: null };
}

export function decodeBase64Url(data: string): string {
  return Buffer.from(
    data.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  ).toString("utf-8");
}

export function extractBody(payload: {
  mimeType?: string | null;
  body?: { data?: string | null } | null;
  parts?: (typeof payload)[] | null;
}): string {
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    // Fallback to text/html if no plain text
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
  }

  return "";
}

interface PayloadPart {
  body?: {
    attachmentId?: string | null;
    data?: string | null;
    size?: number | null;
  } | null;
  filename?: string | null;
  mimeType?: string | null;
  parts?: PayloadPart[] | null;
}

export function extractAttachments(payload: PayloadPart): ParsedAttachment[] {
  const results: ParsedAttachment[] = [];

  function walk(part: PayloadPart) {
    if (part.filename && part.body?.attachmentId) {
      results.push({
        filename: part.filename,
        mimeType: part.mimeType ?? "application/octet-stream",
        size: part.body.size ?? 0,
        attachmentId: part.body.attachmentId,
      });
    }
    if (part.parts) {
      for (const child of part.parts) {
        walk(child);
      }
    }
  }

  walk(payload);
  return results;
}

// Extrae el email del cliente del cuerpo del formulario.
// Busca el patrón "Email" seguido de una dirección en texto plano o HTML.
// Fallback: devuelve la dirección del remitente.
const MAILTO_RE = /href="mailto:([^"]+)"/i;

export function extractClientEmail(body: string, fallback: string): string {
  const match = body.match(MAILTO_RE);
  return match ? match[1].trim() : fallback;
}

export function buildParsedEmail(raw: {
  id: string;
  threadId: string;
  internalDate: string;
  payload: {
    headers: { name: string; value: string }[];
    mimeType?: string | null;
    body?: { data?: string | null } | null;
    parts?: object[] | null;
  };
}): ParsedEmail {
  const headers = raw.payload.headers ?? [];
  const subject =
    headers.find((h) => h.name.toLowerCase() === "subject")?.value ?? "";
  const from =
    headers.find((h) => h.name.toLowerCase() === "from")?.value ?? "";

  const { type, appName } = parseSubject(subject);
  const body = extractBody(raw.payload as Parameters<typeof extractBody>[0]);
  const attachments = extractAttachments(raw.payload as PayloadPart);
  const clientEmail = extractClientEmail(body, from);

  return {
    messageId: raw.id,
    threadId: raw.threadId,
    subject,
    from,
    clientEmail,
    body,
    receivedAt: new Date(Number(raw.internalDate)),
    type,
    appName,
    attachments,
  };
}
