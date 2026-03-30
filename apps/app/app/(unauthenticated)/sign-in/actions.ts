"use server";

import { database } from "@repo/database";
import { createAdminSession } from "@repo/auth/session";
import { redirect } from "next/navigation";
import { scrypt, timingSafeEqual } from "node:crypto";

async function verifyPassword(password: string, stored: string): Promise<boolean> {
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

export async function signInAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = (formData.get("email") as string | null)?.trim().toLowerCase() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) {
    return "Email y contraseña son obligatorios.";
  }

  const user = await database.adminUser.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, passwordHash: true },
  });

  if (!user) {
    return "Credenciales incorrectas.";
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return "Credenciales incorrectas.";
  }

  await createAdminSession(user.id, user.email, user.name);
  redirect("/");
}
