import { createHash } from "node:crypto";
import { database } from "@repo/database";
import { ResetForm } from "./reset-form";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function PasswordResetPage({ params }: Props) {
  const { token } = await params;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const record = await database.passwordResetToken.findUnique({
    where: { token: tokenHash },
    select: { expiresAt: true, usedAt: true },
  });

  const isValid =
    record !== null && !record.usedAt && record.expiresAt > new Date();

  if (!isValid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="w-full max-w-sm rounded-xl border bg-white p-8 text-center shadow-sm">
          <p className="mb-4 font-semibold text-zinc-900">Enlace inválido</p>
          <p className="mb-6 text-sm text-zinc-500">
            Este enlace ha expirado o ya ha sido utilizado. Solicita uno nuevo
            desde la página de acceso.
          </p>
          <a
            className="text-sm text-zinc-700 underline underline-offset-4"
            href="/portal/login"
          >
            Ir al acceso
          </a>
        </div>
      </div>
    );
  }

  return <ResetForm rawToken={token} />;
}
