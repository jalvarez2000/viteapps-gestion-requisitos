import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      // app_user — sin BYPASSRLS, RLS activo. Usado por el runtime de la app.
      // DATABASE_URL (neondb_owner) solo lo lee prisma.config.ts para migraciones.
      DATABASE_APP_URL: z.string().min(1),
    },
    runtimeEnv: {
      DATABASE_APP_URL: process.env.DATABASE_APP_URL,
    },
  });
