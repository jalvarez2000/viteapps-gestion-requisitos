import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const keys = () =>
  createEnv({
    server: {
      AUTH_SESSION_SECRET: z.string().min(32),
    },
    client: {},
    runtimeEnv: {
      AUTH_SESSION_SECRET: process.env.AUTH_SESSION_SECRET,
    },
  });
