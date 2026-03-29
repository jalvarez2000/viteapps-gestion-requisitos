import {
  Body,
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

export interface ReceptionConfirmationEmailProps {
  attachmentCount: number;
  projectName: string;
  replySubject: string;
  requirements: ReceivedRequirement[];
  versionNumber: number;
}

export const ReceptionConfirmationEmail = ({
  projectName,
  versionNumber,
  requirements,
  attachmentCount,
  replySubject,
}: ReceptionConfirmationEmailProps) => {
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
                    {reqs.map((req, i) => (
                      <Section className="mb-3 ml-3" key={i}>
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

                <Text className="m-0 text-sm text-zinc-500">
                  Notre équipe analysera chaque besoin et vous enverra un
                  récapitulatif de la révision prochainement. Si vous souhaitez
                  ajouter des commentaires ou des corrections, répondez à cet
                  e-mail avec l'objet :
                </Text>
                <Text className="mt-2 rounded bg-zinc-100 p-2 font-bold font-mono text-sm text-zinc-800">
                  {replySubject}
                </Text>
              </Section>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
};

ReceptionConfirmationEmail.PreviewProps = {
  projectName: "Portal Clientes",
  versionNumber: 1,
  attachmentCount: 1,
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
  replySubject: "COMENTARIOS A REQUISITOS VERSION EN CURSO: Portal Clientes",
} satisfies ReceptionConfirmationEmailProps;

export default ReceptionConfirmationEmail;
