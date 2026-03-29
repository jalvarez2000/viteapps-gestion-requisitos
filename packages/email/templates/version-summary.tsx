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

export interface RequirementSummary {
  description: string;
  reviewComment?: string | null;
  title: string;
}

export interface GroupSummary {
  confirmed: RequirementSummary[];
  name: string;
  notImplementable: RequirementSummary[];
}

export interface VersionSummaryEmailProps {
  cycleNumber: number;
  groups: GroupSummary[];
  projectName: string;
  replySubject: string;
  versionNumber: number;
}

export const VersionSummaryEmail = ({
  projectName,
  versionNumber,
  cycleNumber,
  groups,
  replySubject,
}: VersionSummaryEmailProps) => {
  const totalConfirmed = groups.reduce((acc, g) => acc + g.confirmed.length, 0);
  const totalNotImplementable = groups.reduce(
    (acc, g) => acc + g.notImplementable.length,
    0
  );

  return (
    <Tailwind>
      <Html>
        <Head />
        <Preview>
          {`Revisión completada — ${projectName} v${versionNumber}`}
        </Preview>
        <Body className="bg-zinc-50 font-sans">
          <Container className="mx-auto max-w-2xl py-12">
            <Section className="mt-8 rounded-md bg-zinc-200 p-px">
              <Section className="rounded-[5px] bg-white p-8">
                <Heading className="mt-0 mb-2 font-bold text-2xl text-zinc-950">
                  Revisión de requisitos completada
                </Heading>
                <Text className="m-0 text-zinc-500">
                  <strong>{projectName}</strong> — Versión {versionNumber}
                  {cycleNumber > 1 && ` (ciclo de revisión ${cycleNumber})`}
                </Text>

                <Hr className="my-6" />

                {/* Summary counters */}
                <Section className="mb-6 flex gap-6">
                  <Text className="m-0 text-sm">
                    ✅ <strong>{totalConfirmed}</strong> requisito(s)
                    confirmado(s)
                  </Text>
                  <Text className="m-0 text-sm">
                    ❌ <strong>{totalNotImplementable}</strong> no
                    implementable(s) en esta versión
                  </Text>
                </Section>

                {/* Confirmed requirements */}
                {totalConfirmed > 0 && (
                  <>
                    <Heading className="mt-0 mb-3 font-semibold text-green-700 text-lg">
                      ✅ Requisitos confirmados para v{versionNumber}
                    </Heading>
                    {groups
                      .filter((g) => g.confirmed.length > 0)
                      .map((group) => (
                        <Section className="mb-4" key={group.name}>
                          <Text className="m-0 mb-2 font-semibold text-sm text-zinc-700">
                            {group.name}
                          </Text>
                          {group.confirmed.map((req) => (
                            <Section className="mb-2 ml-3" key={req.title}>
                              <Text className="m-0 text-sm text-zinc-900">
                                • {req.title}
                              </Text>
                              <Text className="m-0 ml-2 text-xs text-zinc-500">
                                {req.description}
                              </Text>
                              {req.reviewComment && (
                                <Text className="m-0 ml-2 text-xs text-zinc-400 italic">
                                  Nota: {req.reviewComment}
                                </Text>
                              )}
                            </Section>
                          ))}
                        </Section>
                      ))}
                  </>
                )}

                {/* Not implementable */}
                {totalNotImplementable > 0 && (
                  <>
                    <Hr className="my-4" />
                    <Heading className="mt-0 mb-3 font-semibold text-lg text-red-700">
                      ❌ No incluidos en esta versión
                    </Heading>
                    {groups
                      .filter((g) => g.notImplementable.length > 0)
                      .map((group) => (
                        <Section className="mb-4" key={group.name}>
                          <Text className="m-0 mb-2 font-semibold text-sm text-zinc-700">
                            {group.name}
                          </Text>
                          {group.notImplementable.map((req) => (
                            <Section className="mb-2 ml-3" key={req.title}>
                              <Text className="m-0 text-sm text-zinc-900">
                                • {req.title}
                              </Text>
                              {req.reviewComment && (
                                <Text className="m-0 ml-2 text-xs text-zinc-500 italic">
                                  Motivo: {req.reviewComment}
                                </Text>
                              )}
                            </Section>
                          ))}
                        </Section>
                      ))}
                  </>
                )}

                <Hr className="my-6" />

                <Text className="m-0 text-sm text-zinc-500">
                  Si desea comentar sobre esta revisión, responda a este correo
                  con el asunto:
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

VersionSummaryEmail.PreviewProps = {
  projectName: "Portal Clientes",
  versionNumber: 1,
  cycleNumber: 1,
  groups: [
    {
      name: "Autenticación",
      confirmed: [
        {
          title: "Login con email y contraseña",
          description: "El usuario puede iniciar sesión con sus credenciales",
        },
      ],
      notImplementable: [
        {
          title: "Login con huella dactilar",
          description: "Autenticación biométrica en app móvil",
          reviewComment: "Fuera del alcance de la versión web inicial",
        },
      ],
    },
  ],
  replySubject: "COMENTARIOS A REQUISITOS VERSION EN CURSO: Portal Clientes",
} satisfies VersionSummaryEmailProps;

export default VersionSummaryEmail;
