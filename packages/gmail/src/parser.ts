import type { EmailType, ParsedAttachment, ParsedEmail } from "./types";

// Patterns:
//   NUEVA APP: XXXXXX
//   NUEVOS REQUISITOS APP: XXXXXX
//   COMENTARIOS A REQUISITOS VERSION EN CURSO: XXXXXX
//   [ViteApps] Nouvelle demande — Name · Projet SIZE · email@domain.com
const PATTERNS: { type: EmailType; regex: RegExp }[] = [
  {
    type: "NEW_APP",
    regex: /^NUEVA\s+APP\s*:\s*(.+)$/i,
  },
  {
    type: "NEW_REQUIREMENTS",
    regex: /^NUEVOS\s+REQUISITOS\s+APP\s*:\s*(.+)$/i,
  },
];

// ViteApps subject: [ViteApps] Nouvelle demande — Jean Dupont · Projet M [· jean@mail.com]
// The email part is optional — some forms omit it
const VITEAPPS_FULL_RE =
  /^\[ViteApps\]\s+Nouvelle\s+demande\s+[—-]\s+(.+?)\s+[·•]\s+Projet\s+([XSML]{1,2})(?:\s+[·•]\s+(\S+@\S+))?$/i;
// Fallback: any ViteApps form email (no size/email extraction)
const VITEAPPS_FALLBACK_RE = /^\[ViteApps\]\s+Nouvelle\s+demande/i;

export function parseSubject(subject: string): {
  type: EmailType;
  appName: string | null;
  subjectClientEmail?: string;
  subjectUserSize?: UserSize;
} {
  const cleaned = subject.trim();

  // Try full structured ViteApps format first
  const viteMatch = cleaned.match(VITEAPPS_FULL_RE);
  if (viteMatch) {
    const rawSize = viteMatch[2].toUpperCase();
    const subjectUserSize =
      rawSize === "XS" ||
      rawSize === "S" ||
      rawSize === "M" ||
      rawSize === "L" ||
      rawSize === "XL"
        ? (rawSize as UserSize)
        : null;
    return {
      type: "NEW_APP",
      appName: viteMatch[1].trim(),
      subjectClientEmail: viteMatch[3]?.trim(),
      subjectUserSize,
    };
  }

  // Fallback: ViteApps email without expected structure — still process it
  if (VITEAPPS_FALLBACK_RE.test(cleaned)) {
    return { type: "NEW_APP", appName: cleaned };
  }

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
const COMPLEXITE_RE = /complexit[eé][^a-zA-Z]*([XSML]{1,2})/i;

export type UserSize = "XS" | "S" | "M" | "L" | "XL" | null;

export function extractClientEmail(body: string, fallback: string): string {
  const match = body.match(MAILTO_RE);
  return match ? match[1].trim() : fallback;
}

// Extrae la talla indicada por el usuario en el campo "Complexité" del formulario.
// Devuelve null si no se indicó ("Non précisé" u omitido).
export function extractUserSize(body: string): UserSize {
  const text = body.replace(/<[^>]+>/g, " ");
  const match = text.match(COMPLEXITE_RE);
  if (!match) {
    return null;
  }
  const raw = match[1].toUpperCase();
  if (
    raw === "XS" ||
    raw === "S" ||
    raw === "M" ||
    raw === "L" ||
    raw === "XL"
  ) {
    return raw;
  }
  return null;
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

  const { type, appName, subjectClientEmail, subjectUserSize } =
    parseSubject(subject);
  const body = extractBody(raw.payload as Parameters<typeof extractBody>[0]);
  const attachments = extractAttachments(raw.payload as PayloadPart);
  const clientEmail = subjectClientEmail ?? extractClientEmail(body, from);
  const userSize =
    subjectUserSize !== undefined ? subjectUserSize : extractUserSize(body);

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
    userSize,
  };
}
