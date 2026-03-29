"use server";

import { createHash, randomBytes } from "node:crypto";
import { database } from "@repo/database";
import { sendPasswordReset } from "@repo/gmail";
import { redirect } from "next/navigation";
import {
  createSessionCookie,
  hashPassword,
  verifyPassword,
} from "@/lib/portal-session";

// ─── Bloque 1: primer acceso y login ─────────────────────────────────────────

export type CheckResult =
  | { status: "needs_setup"; projectName: string }
  | { status: "needs_password"; projectName: string }
  | { status: "error"; message: string };

export async function checkProject(
  code: string,
  email: string
): Promise<CheckResult> {
  const project = await database.project.findUnique({
    where: { code: code.trim().toUpperCase() },
    select: {
      id: true,
      name: true,
      clientEmail: true,
      clientPassword: true,
    },
  });

  if (!project) {
    return { status: "error", message: "Proyecto no encontrado." };
  }
  if (project.clientEmail.toLowerCase() !== email.trim().toLowerCase()) {
    return { status: "error", message: "Correo no asociado a este proyecto." };
  }

  if (!project.clientPassword) {
    return { status: "needs_setup", projectName: project.name };
  }

  return { status: "needs_password", projectName: project.name };
}

export type SetupResult = { error: string } | null;

export async function setupPassword(
  code: string,
  email: string,
  password: string,
  confirmPassword: string
): Promise<SetupResult> {
  if (password !== confirmPassword) {
    return { error: "Las contraseñas no coinciden." };
  }
  if (password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }

  const normalizedCode = code.trim().toUpperCase();
  const project = await database.project.findUnique({
    where: { code: normalizedCode },
    select: { id: true, clientEmail: true, clientPassword: true },
  });

  if (!project) {
    return { error: "Proyecto no encontrado." };
  }
  if (project.clientEmail.toLowerCase() !== email.trim().toLowerCase()) {
    return { error: "Credenciales incorrectas." };
  }
  // No sobrescribir si ya existe (p.ej. doble envío)
  if (project.clientPassword) {
    return {
      error: "Este acceso ya tiene contraseña. Usa el formulario de login.",
    };
  }

  const hash = await hashPassword(password);
  await database.project.update({
    where: { id: project.id },
    data: { clientPassword: hash },
  });

  await createSessionCookie(normalizedCode, email.trim().toLowerCase());
  redirect(`/portal/${normalizedCode}`);
}

export type LoginResult = { error: string } | null;

export async function loginWithPassword(
  code: string,
  email: string,
  password: string
): Promise<LoginResult> {
  const project = await database.project.findUnique({
    where: { code: code.trim().toUpperCase() },
    select: { clientEmail: true, clientPassword: true },
  });

  if (!project?.clientPassword) {
    return { error: "Error de autenticación." };
  }
  if (project.clientEmail.toLowerCase() !== email.trim().toLowerCase()) {
    return { error: "Credenciales incorrectas." };
  }

  const valid = await verifyPassword(password, project.clientPassword);
  if (!valid) {
    return { error: "Contraseña incorrecta." };
  }

  const normalizedCode = code.trim().toUpperCase();
  await createSessionCookie(normalizedCode, email.trim().toLowerCase());
  redirect(`/portal/${normalizedCode}`);
}

// ─── Bloque 2: reset de contraseña ───────────────────────────────────────────

export async function requestPasswordReset(
  code: string,
  email: string
): Promise<{ status: "sent" }> {
  const normalizedCode = code.trim().toUpperCase();
  const project = await database.project.findUnique({
    where: { code: normalizedCode },
    select: { id: true, name: true, clientEmail: true },
  });

  // Respuesta neutral — no revelar si el proyecto/email existe
  if (
    !project ||
    project.clientEmail.toLowerCase() !== email.trim().toLowerCase()
  ) {
    return { status: "sent" };
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");

  await database.passwordResetToken.create({
    data: {
      projectId: project.id,
      token: tokenHash,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
    },
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  await sendPasswordReset({
    to: project.clientEmail,
    props: {
      projectName: project.name,
      resetUrl: `${appUrl}/portal/reset/${rawToken}`,
    },
  });

  return { status: "sent" };
}
