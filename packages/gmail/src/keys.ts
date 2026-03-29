import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      GMAIL_CLIENT_ID: z.string().min(1),
      GMAIL_CLIENT_SECRET: z.string().min(1),
      GMAIL_REFRESH_TOKEN: z.string().min(1),
      GMAIL_TARGET_ADDRESS: z.string().email(),
      CRON_SECRET: z.string().min(1),
    },
    runtimeEnv: {
      GMAIL_CLIENT_ID: process.env.GMAIL_CLIENT_ID,
      GMAIL_CLIENT_SECRET: process.env.GMAIL_CLIENT_SECRET,
      GMAIL_REFRESH_TOKEN: process.env.GMAIL_REFRESH_TOKEN,
      GMAIL_TARGET_ADDRESS: process.env.GMAIL_TARGET_ADDRESS,
      CRON_SECRET: process.env.CRON_SECRET,
    },
  });
