import { Resend } from "resend";
import { render } from "@react-email/render";
import { keys } from "./keys";
import { VersionSummaryEmail } from "./templates/version-summary";
import type { VersionSummaryEmailProps } from "./templates/version-summary";

const { RESEND_TOKEN, RESEND_FROM } = keys();

export const resend = RESEND_TOKEN ? new Resend(RESEND_TOKEN) : undefined;

export async function sendVersionSummary(params: {
  to: string;
  props: VersionSummaryEmailProps;
}) {
  if (!resend) {
    console.warn("[email] Resend not configured — skipping sendVersionSummary");
    return;
  }

  const html = await render(<VersionSummaryEmail {...params.props} />);
  const subject = `[${params.props.projectName}] Revisión de requisitos v${params.props.versionNumber}`;

  await resend.emails.send({
    from: RESEND_FROM,
    to: params.to,
    subject,
    html,
  });
}

export { VersionSummaryEmail };
export type { VersionSummaryEmailProps, GroupSummary, RequirementSummary } from "./templates/version-summary";
