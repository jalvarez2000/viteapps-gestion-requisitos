import { config, withAnalyzer } from "@repo/next-config";
import { withLogging, withSentry } from "@repo/observability/next-config";
import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";
import { env } from "@/env";

let baseConfig: NextConfig = withLogging(config);

if (env.VERCEL) {
  baseConfig = withSentry(baseConfig);
}

if (env.ANALYZE === "true") {
  baseConfig = withAnalyzer(baseConfig);
}

export default withWorkflow(baseConfig);
