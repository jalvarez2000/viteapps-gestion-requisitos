import "server-only";

import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

async function getSigningKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    throw new Error("AUTH_SESSION_SECRET is not set");
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function createAdminSession(
  userId: string,
  email: string,
  name: string
): Promise<void> {
  const payload = JSON.stringify({
    userId,
    email,
    name,
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
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function getAdminSession(): Promise<{
  userId: string;
  email: string;
  name: string;
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
    ) as { userId: string; email: string; name: string; exp: number };

    if (payload.exp < Date.now()) {
      return null;
    }

    return { userId: payload.userId, email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}

export async function deleteAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
