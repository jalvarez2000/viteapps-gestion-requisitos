import type { ReactNode } from "react";

export const CollaborationProvider = ({
  children,
}: {
  orgId: string;
  children: ReactNode;
}) => <>{children}</>;
