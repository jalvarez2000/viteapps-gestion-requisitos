"use client";

import { LogOutIcon, UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

interface UserButtonProps {
  email?: string;
  name?: string;
  showName?: boolean;
}

export function UserButton({ email, name, showName }: UserButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const display = name ?? email ?? "Usuario";

  return (
    <div className="flex w-full items-center gap-2">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700">
        <UserIcon className="h-4 w-4 text-zinc-600 dark:text-zinc-300" />
      </div>
      {showName && (
        <span className="flex-1 truncate text-sm">{display}</span>
      )}
      <button
        aria-label="Cerrar sesión"
        className="ml-auto rounded p-1 text-zinc-400 transition-colors hover:text-zinc-700 disabled:opacity-50 dark:hover:text-zinc-200"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/sign-in");
            router.refresh();
          });
        }}
        type="button"
      >
        <LogOutIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
