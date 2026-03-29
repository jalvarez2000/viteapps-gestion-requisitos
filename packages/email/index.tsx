import { render } from "@react-email/render";
import type { ReceptionConfirmationEmailProps } from "./templates/reception-confirmation";
import { ReceptionConfirmationEmail } from "./templates/reception-confirmation";
import type { VersionSummaryEmailProps } from "./templates/version-summary";
import { VersionSummaryEmail } from "./templates/version-summary";

export async function renderVersionSummary(
  props: VersionSummaryEmailProps
): Promise<{ html: string; subject: string }> {
  const html = await render(<VersionSummaryEmail {...props} />);
  const subject = `[${props.projectName}] Revisión de requisitos v${props.versionNumber}`;
  return { html, subject };
}

export async function renderReceptionConfirmation(
  props: ReceptionConfirmationEmailProps
): Promise<{ html: string; subject: string }> {
  const html = await render(<ReceptionConfirmationEmail {...props} />);
  const subject = `[${props.projectName}] Nous avons bien reçu vos besoins v${props.versionNumber}`;
  return { html, subject };
}

export { VersionSummaryEmail, ReceptionConfirmationEmail };
export type {
  ReceivedRequirement,
  ReceptionConfirmationEmailProps,
} from "./templates/reception-confirmation";
export type {
  GroupSummary,
  RequirementSummary,
  VersionSummaryEmailProps,
} from "./templates/version-summary";
