"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition } from "react";
import {
  checkProject,
  loginWithPassword,
  requestPasswordReset,
  setupPassword,
} from "./actions";

type Step = "credentials" | "setup" | "password" | "forgot" | "reset_sent";

const STEP_SUBTITLES: Record<Step, string> = {
  credentials: "Introduce el código de proyecto y tu correo.",
  setup: "Bienvenido. Crea tu contraseña de acceso.",
  password: "",
  forgot: "Te enviaremos un enlace para restablecer tu contraseña.",
  reset_sent: "Si los datos coinciden, recibirás un correo en breve.",
};

// ─── Step sub-components ──────────────────────────────────────────────────────

function CredentialsStep({
  code,
  email,
  error,
  isPending,
  onCode,
  onEmail,
  onSubmit,
}: {
  code: string;
  email: string;
  error: string;
  isPending: boolean;
  onCode: (v: string) => void;
  onEmail: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="code">Código de proyecto</Label>
        <Input
          disabled={isPending}
          id="code"
          onChange={(e) => onCode(e.target.value.toUpperCase())}
          placeholder="PORTALCLIENT-001"
          value={code}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          disabled={isPending}
          id="email"
          onChange={(e) => onEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="tu@correo.com"
          type="email"
          value={email}
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <Button
        className="w-full"
        disabled={isPending || !code || !email}
        onClick={onSubmit}
      >
        {isPending ? "Verificando…" : "Continuar"}
      </Button>
    </>
  );
}

function SetupStep({
  password,
  confirmPassword,
  error,
  isPending,
  onPassword,
  onConfirm,
  onSubmit,
  onBack,
}: {
  password: string;
  confirmPassword: string;
  error: string;
  isPending: boolean;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="password">Nueva contraseña</Label>
        <Input
          autoFocus
          disabled={isPending}
          id="password"
          onChange={(e) => onPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="Mínimo 8 caracteres"
          type="password"
          value={password}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="confirm">Confirmar contraseña</Label>
        <Input
          disabled={isPending}
          id="confirm"
          onChange={(e) => onConfirm(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="Repite la contraseña"
          type="password"
          value={confirmPassword}
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <Button
        className="w-full"
        disabled={isPending || !password || !confirmPassword}
        onClick={onSubmit}
      >
        {isPending ? "Guardando…" : "Crear contraseña"}
      </Button>
      <Button className="w-full" onClick={onBack} variant="ghost">
        Volver
      </Button>
    </>
  );
}

function PasswordStep({
  password,
  error,
  isPending,
  onPassword,
  onSubmit,
  onBack,
  onForgot,
}: {
  password: string;
  error: string;
  isPending: boolean;
  onPassword: (v: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  onForgot: () => void;
}) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          autoFocus
          disabled={isPending}
          id="password"
          onChange={(e) => onPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          placeholder="••••••••"
          type="password"
          value={password}
        />
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <Button
        className="w-full"
        disabled={isPending || !password}
        onClick={onSubmit}
      >
        {isPending ? "Accediendo…" : "Entrar"}
      </Button>
      <div className="flex gap-2">
        <Button className="flex-1" onClick={onBack} variant="ghost">
          Volver
        </Button>
        <Button className="flex-1" onClick={onForgot} variant="ghost">
          ¿Olvidaste la contraseña?
        </Button>
      </div>
    </>
  );
}

function ForgotStep({
  code,
  email,
  error,
  isPending,
  onSubmit,
  onBack,
}: {
  code: string;
  email: string;
  error: string;
  isPending: boolean;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <p className="text-xs text-zinc-400">
        Código: <span className="font-mono">{code}</span> · Correo:{" "}
        <span className="font-mono">{email}</span>
      </p>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <Button className="w-full" disabled={isPending} onClick={onSubmit}>
        {isPending ? "Enviando…" : "Enviar enlace de reset"}
      </Button>
      <Button className="w-full" onClick={onBack} variant="ghost">
        Volver
      </Button>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PortalLoginPage() {
  return (
    <Suspense>
      <PortalLoginPageInner />
    </Suspense>
  );
}

function PortalLoginPageInner() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get("code") ?? "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step, setStep] = useState<Step>("credentials");
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function goBack() {
    setStep("credentials");
    setError("");
    setPassword("");
    setConfirmPassword("");
  }

  function handleCheck() {
    setError("");
    startTransition(async () => {
      const result = await checkProject(code, email);
      if (result.status === "error") {
        setError(result.message);
      } else {
        setProjectName(result.projectName);
        setStep(result.status === "needs_setup" ? "setup" : "password");
      }
    });
  }

  function handleSetup() {
    setError("");
    startTransition(async () => {
      const result = await setupPassword(
        code,
        email,
        password,
        confirmPassword
      );
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  function handleLogin() {
    setError("");
    startTransition(async () => {
      const result = await loginWithPassword(code, email, password);
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  function handleForgot() {
    setError("");
    startTransition(async () => {
      await requestPasswordReset(code, email);
      setStep("reset_sent");
    });
  }

  function getSubtitle(): string {
    if (step === "password") {
      return `Proyecto: ${projectName}`;
    }
    if (step === "setup") {
      return `Bienvenido a ${projectName}. Crea tu contraseña.`;
    }
    return STEP_SUBTITLES[step];
  }

  const subtitle = getSubtitle();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="mb-1 font-bold text-xl text-zinc-900">
          Acceso al portal
        </h1>
        <p className="mb-6 text-sm text-zinc-500">{subtitle}</p>

        <div className="space-y-4">
          {step === "credentials" && (
            <CredentialsStep
              code={code}
              email={email}
              error={error}
              isPending={isPending}
              onCode={setCode}
              onEmail={setEmail}
              onSubmit={handleCheck}
            />
          )}
          {step === "setup" && (
            <SetupStep
              confirmPassword={confirmPassword}
              error={error}
              isPending={isPending}
              onBack={goBack}
              onConfirm={setConfirmPassword}
              onPassword={setPassword}
              onSubmit={handleSetup}
              password={password}
            />
          )}
          {step === "password" && (
            <PasswordStep
              error={error}
              isPending={isPending}
              onBack={goBack}
              onForgot={() => {
                setStep("forgot");
                setError("");
              }}
              onPassword={setPassword}
              onSubmit={handleLogin}
              password={password}
            />
          )}
          {step === "forgot" && (
            <ForgotStep
              code={code}
              email={email}
              error={error}
              isPending={isPending}
              onBack={() => setStep("password")}
              onSubmit={handleForgot}
            />
          )}
          {step === "reset_sent" && (
            <Button className="w-full" onClick={goBack} variant="outline">
              Volver al inicio
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
