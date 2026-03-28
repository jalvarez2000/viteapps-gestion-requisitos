import { render } from "@react-email/render";
import { VersionSummaryEmail } from "./templates/version-summary";
import type { VersionSummaryEmailProps } from "./templates/version-summary";

export async function renderVersionSummary(
  props: VersionSummaryEmailProps
): Promise<{ html: string; subject: string }> {
  const html = await render(<VersionSummaryEmail {...props} />);
  const subject = `[${props.projectName}] Revisión de requisitos v${props.versionNumber}`;
  return { html, subject };
}

export { VersionSummaryEmail };
export type { VersionSummaryEmailProps, GroupSummary, RequirementSummary } from "./templates/version-summary";
