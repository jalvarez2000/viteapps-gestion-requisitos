import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";

export interface PasswordResetEmailProps {
  projectName: string;
  resetUrl: string;
}

export const PasswordResetEmail = ({
  projectName,
  resetUrl,
}: PasswordResetEmailProps) => (
  <Tailwind>
    <Html>
      <Head />
      <Preview>Réinitialisation de votre mot de passe — {projectName}</Preview>
      <Body className="bg-zinc-50 font-sans">
        <Container className="mx-auto max-w-2xl py-12">
          <Section className="mt-8 rounded-md bg-zinc-200 p-px">
            <Section className="rounded-[5px] bg-white p-8">
              <Heading className="mt-0 mb-2 font-bold text-2xl text-zinc-950">
                Réinitialisation du mot de passe
              </Heading>
              <Text className="m-0 text-zinc-500">
                Vous avez demandé à réinitialiser le mot de passe de votre
                espace client pour le projet <strong>{projectName}</strong>.
              </Text>

              <Hr className="my-6" />

              <Text className="m-0 mb-4 text-sm text-zinc-700">
                Cliquez sur le bouton ci-dessous pour choisir un nouveau mot de
                passe. Ce lien est valable <strong>15 minutes</strong>.
              </Text>

              <Button
                className="rounded bg-zinc-900 px-5 py-3 font-semibold text-sm text-white"
                href={resetUrl}
              >
                Réinitialiser mon mot de passe
              </Button>

              <Hr className="my-6" />

              <Text className="m-0 text-xs text-zinc-400">
                Si vous n'avez pas demandé cette réinitialisation, ignorez cet
                e-mail. Votre mot de passe actuel reste inchangé.
              </Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  </Tailwind>
);

PasswordResetEmail.PreviewProps = {
  projectName: "Portal Clientes",
  resetUrl: "http://localhost:3000/portal/reset/abc123token",
} satisfies PasswordResetEmailProps;

export default PasswordResetEmail;
