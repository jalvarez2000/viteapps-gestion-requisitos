"use client";

import type { ReactNode } from "react";

interface AuthProviderProperties {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProperties) => {
  return <>{children}</>;
};
