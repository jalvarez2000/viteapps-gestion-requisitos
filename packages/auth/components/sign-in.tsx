"use client";

import { useActionState } from "react";

type SignInAction = (
  prevState: string | null,
  formData: FormData
) => Promise<string | null>;

interface SignInProps {
  action: SignInAction;
}

export const SignIn = ({ action }: SignInProps) => {
  const [error, formAction, isPending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-4" suppressHydrationWarning>
      <div className="flex flex-col gap-1">
        <label className="font-medium text-sm" htmlFor="email">
          Email
        </label>
        <input
          autoComplete="email"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          id="email"
          name="email"
          required
          type="email"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="font-medium text-sm" htmlFor="password">
          Contraseña
        </label>
        <input
          autoComplete="current-password"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          id="password"
          name="password"
          required
          type="password"
        />
      </div>
      {error && (
        <p className="text-destructive text-sm">{error}</p>
      )}
      <button
        className="rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
};
