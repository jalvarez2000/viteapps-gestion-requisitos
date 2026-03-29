"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { useState, useTransition } from "react";
import { completePasswordReset } from "./actions";

export function ResetForm({ rawToken }: { rawToken: string }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      const result = await completePasswordReset(
        rawToken,
        password,
        confirmPassword
      );
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-sm rounded-xl border bg-white p-8 shadow-sm">
        <h1 className="mb-1 font-bold text-xl text-zinc-900">
          Nueva contraseña
        </h1>
        <p className="mb-6 text-sm text-zinc-500">
          Elige una nueva contraseña para acceder a tu portal.
        </p>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="password">Nueva contraseña</Label>
            <Input
              autoFocus
              disabled={isPending}
              id="password"
              onChange={(e) => setPassword(e.target.value)}
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
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="Repite la contraseña"
              type="password"
              value={confirmPassword}
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button
            className="w-full"
            disabled={isPending || !password || !confirmPassword}
            onClick={handleSubmit}
          >
            {isPending ? "Guardando…" : "Guardar contraseña"}
          </Button>
        </div>
      </div>
    </div>
  );
}
