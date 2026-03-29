import type { ReactNode } from "react";

// Portal del cliente — autenticación propia, sin Clerk.
// Fuerza tema claro independientemente del sistema del usuario.
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="light min-h-screen bg-slate-50 text-zinc-900">
      {children}
    </div>
  );
}
