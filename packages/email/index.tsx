import { render } from "@react-email/render";
import type { PasswordResetEmailProps } from "./templates/password-reset";
import { PasswordResetEmail } from "./templates/password-reset";
import type { ReceptionConfirmationEmailProps } from "./templates/reception-confirmation";
import { ReceptionConfirmationEmail } from "./templates/reception-confirmation";
import type { VersionSummaryEmailProps } from "./templates/version-summary";
import { VersionSummaryEmail } from "./templates/version-summary";

export async function renderPasswordReset(
  props: PasswordResetEmailProps
): Promise<{ html: string; subject: string }> {
  const html = await render(<PasswordResetEmail {...props} />);
  const subject = `[${props.projectName}] Réinitialisation de votre mot de passe`;
  return { html, subject };
}

export async function renderReceptionConfirmation(
  props: ReceptionConfirmationEmailProps
): Promise<{ html: string; subject: string }> {
  const html = await render(<ReceptionConfirmationEmail {...props} />);
  const subject = `[${props.projectName}] Nous avons bien reçu vos besoins v${props.versionNumber}`;
  return { html, subject };
}

export async function renderVersionSummary(
  props: VersionSummaryEmailProps
): Promise<{ html: string; subject: string }> {
  const html = await render(<VersionSummaryEmail {...props} />);
  const subject = `[${props.projectName}] Revisión de requisitos v${props.versionNumber}`;
  return { html, subject };
}

export type { PasswordResetEmailProps } from "./templates/password-reset";
export type {
  ReceivedRequirement,
  ReceptionConfirmationEmailProps,
} from "./templates/reception-confirmation";
export type {
  GroupSummary,
  RequirementSummary,
  VersionSummaryEmailProps,
} from "./templates/version-summary";
