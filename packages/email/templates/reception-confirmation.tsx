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

export interface ReceivedRequirement {
  description: string;
  group: string;
  title: string;
}

export type ProjectSize = "XS" | "S" | "M" | "L" | "XL";

export interface ReceptionConfirmationEmailProps {
  aiSize: ProjectSize;
  attachmentCount: number;
  portalUrl: string;
  projectName: string;
  requirements: ReceivedRequirement[];
  userSize: ProjectSize | null;
  versionNumber: number;
}

const SIZE_LABELS: Record<ProjectSize, string> = {
  XS: "XS — Una pantalla, una función",
  S: "S — 3-5 pantallas, flujo lineal",
  M: "M — Múltiples módulos, multi-usuario",
  L: "L — Múltiples tipos de usuario, integraciones",
  XL: "XL — Arquitectura distribuida, alta concurrencia",
};

export const ReceptionConfirmationEmail = ({
  projectName,
  versionNumber,
  requirements,
  attachmentCount,
  userSize,
  aiSize,
  portalUrl,
}: ReceptionConfirmationEmailProps) => {
  const hasMismatch = userSize !== null && userSize !== aiSize;
  // Group requirements by functional area
  const grouped = requirements.reduce<Record<string, ReceivedRequirement[]>>(
    (acc, req) => {
      if (!acc[req.group]) {
        acc[req.group] = [];
      }
      acc[req.group].push(req);
      return acc;
    },
    {}
  );

  return (
    <Tailwind>
      <Html>
        <Head />
        <Preview>
          {`Nous avons bien reçu vos besoins — ${projectName} v${versionNumber}`}
        </Preview>
        <Body className="bg-zinc-50 font-sans">
          <Container className="mx-auto max-w-2xl py-12">
            <Section className="mt-8 rounded-md bg-zinc-200 p-px">
              <Section className="rounded-[5px] bg-white p-8">
                <Heading className="mt-0 mb-2 font-bold text-2xl text-zinc-950">
                  Merci pour votre demande !
                </Heading>
                <Text className="m-0 text-zinc-500">
                  Nous avons bien reçu et traité votre demande pour{" "}
                  <strong>{projectName}</strong> — Version {versionNumber}.
                </Text>

                <Hr className="my-6" />

                <Text className="m-0 mb-4 text-sm text-zinc-700">
                  Vous trouverez ci-dessous un récapitulatif des{" "}
                  <strong>{requirements.length} besoin(s)</strong> que nous
                  avons extraits de votre message
                  {attachmentCount > 0
                    ? ` et de ${attachmentCount} pièce(s) jointe(s)`
                    : ""}{" "}
                  :
                </Text>

                {Object.entries(grouped).map(([group, reqs]) => (
                  <Section className="mb-5" key={group}>
                    <Text className="m-0 mb-2 border-zinc-200 border-b pb-1 font-semibold text-sm text-zinc-800">
                      {group}
                    </Text>
                    {reqs.map((req) => (
                      <Section className="mb-3 ml-3" key={req.title}>
                        <Text className="m-0 font-medium text-sm text-zinc-900">
                          • {req.title}
                        </Text>
                        <Text className="m-0 ml-2 text-xs text-zinc-500">
                          {req.description}
                        </Text>
                      </Section>
                    ))}
                  </Section>
                ))}

                <Hr className="my-6" />

                {/* Size assessment section */}
                <Text className="m-0 mb-3 font-semibold text-sm text-zinc-800">
                  Complexité du projet
                </Text>
                <Section className="mb-2 rounded bg-zinc-50 p-3">
                  <Text className="m-0 text-sm text-zinc-700">
                    <strong>Notre estimation :</strong> {SIZE_LABELS[aiSize]}
                  </Text>
                  {userSize ? (
                    <Text className="m-0 mt-1 text-sm text-zinc-700">
                      <strong>Taille indiquée :</strong> {SIZE_LABELS[userSize]}
                    </Text>
                  ) : null}
                </Section>
                {hasMismatch ? (
                  <Text className="m-0 mb-4 text-amber-700 text-sm">
                    ⚠ La taille que vous avez indiquée ({userSize}) diffère de
                    notre estimation ({aiSize}). Notre équipe vous contactera si
                    un ajustement du périmètre est nécessaire.
                  </Text>
                ) : (
                  <Text className="m-0 mb-4 text-sm text-zinc-500">
                    Notre estimation de complexité correspond à la taille
                    indiquée.
                  </Text>
                )}

                <Hr className="my-6" />

                <Text className="m-0 mb-4 text-sm text-zinc-500">
                  Vous pouvez consulter vos besoins et leur avancement à tout
                  moment depuis votre espace client :
                </Text>
                <Button
                  className="rounded bg-zinc-900 px-5 py-3 font-semibold text-sm text-white"
                  href={portalUrl}
                >
                  Accéder à mon espace
                </Button>

              </Section>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
};

ReceptionConfirmationEmail.PreviewProps = {
  aiSize: "M",
  attachmentCount: 1,
  portalUrl: "http://localhost:3000/portal/PORTALCLIENT-001",
  projectName: "Portal Clientes",
  requirements: [
    {
      group: "Autenticación",
      title: "Login con email y contraseña",
      description: "El usuario puede iniciar sesión con sus credenciales.",
    },
    {
      group: "Autenticación",
      title: "Recuperación de contraseña",
      description: "El usuario puede solicitar un enlace de recuperación.",
    },
    {
      group: "Gestión de usuarios",
      title: "Perfil de usuario",
      description: "El usuario puede ver y editar su perfil.",
    },
  ],
  userSize: "S",
  versionNumber: 1,
} satisfies ReceptionConfirmationEmailProps;

export default ReceptionConfirmationEmail;
