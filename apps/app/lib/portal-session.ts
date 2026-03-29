import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "portal_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 días en segundos

// ─── Password (scrypt, sin dependencias extra) ────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 32, (err, key) =>
      err ? reject(err) : resolve(key)
    );
  });
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!(salt && hash)) {
    return false;
  }
  const hashBuf = Buffer.from(hash, "hex");
  const derivedBuf = await new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, 32, (err, key) =>
      err ? reject(err) : resolve(key)
    );
  });
  return timingSafeEqual(hashBuf, derivedBuf);
}

export function generatePassword(): string {
  // 12 chars URL-safe — fácil de copiar
  return randomBytes(9).toString("base64url");
}

// ─── Session token (HMAC-SHA256, Web Crypto) ──────────────────────────────────

async function getSigningKey(): Promise<CryptoKey> {
  const secret = process.env.PORTAL_SESSION_SECRET;
  if (!secret) {
    throw new Error("PORTAL_SESSION_SECRET no está configurado");
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createSessionCookie(
  projectCode: string,
  email: string
): Promise<void> {
  const payload = JSON.stringify({
    projectCode,
    email,
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  });
  const dataB64 = Buffer.from(payload).toString("base64url");
  const key = await getSigningKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(dataB64)
  );
  const token = `${dataB64}.${Buffer.from(sig).toString("base64url")}`;

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/portal",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function getPortalSession(): Promise<{
  projectCode: string;
  email: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const dotIdx = token.lastIndexOf(".");
  if (dotIdx === -1) {
    return null;
  }
  const dataB64 = token.slice(0, dotIdx);
  const sigB64 = token.slice(dotIdx + 1);

  try {
    const key = await getSigningKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      Buffer.from(sigB64, "base64url"),
      new TextEncoder().encode(dataB64)
    );
    if (!valid) {
      return null;
    }

    const payload = JSON.parse(
      Buffer.from(dataB64, "base64url").toString()
    ) as { projectCode: string; email: string; exp: number };
    if (payload.exp < Date.now()) {
      return null;
    }

    return { projectCode: payload.projectCode, email: payload.email };
  } catch {
    return null;
  }
}
