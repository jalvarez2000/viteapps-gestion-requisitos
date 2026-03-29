"use server";

import { createHash } from "node:crypto";
import { database } from "@repo/database";
import { redirect } from "next/navigation";
import { createSessionCookie, hashPassword } from "@/lib/portal-session";

export type ResetResult = { error: string } | null;

export async function completePasswordReset(
  rawToken: string,
  newPassword: string,
  confirmPassword: string
): Promise<ResetResult> {
  if (newPassword !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }
  if (newPassword.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  const record = await database.passwordResetToken.findUnique({
    where: { token: tokenHash },
    include: {
      project: { select: { id: true, code: true, clientEmail: true } },
    },
  });

  if (!record) {
    return { error: "Enlace inválido o expirado." };
  }
  if (record.usedAt) {
    return { error: "Este enlace ya ha sido utilizado." };
  }
  if (record.expiresAt < new Date()) {
    return { error: "El enlace ha expirado. Solicita uno nuevo." };
  }

  const newHash = await hashPassword(newPassword);

  await database.project.update({
    where: { id: record.project.id },
    data: { clientPassword: newHash },
  });

  await database.passwordResetToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  await createSessionCookie(
    record.project.code,
    record.project.clientEmail.toLowerCase()
  );

  redirect(`/portal/${record.project.code}`);
}
