"use client";

import { NotificationsProvider as RawNotificationsProvider } from "@repo/notifications/components/provider";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useState } from "react";

interface NotificationsProviderProperties {
  children: ReactNode;
  userId: string;
}

export const NotificationsProvider = ({
  children,
  userId,
}: NotificationsProviderProperties) => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <RawNotificationsProvider
      theme={mounted ? (resolvedTheme as "light" | "dark") : "dark"}
      userId={userId}
    >
      {children}
    </RawNotificationsProvider>
  );
};
