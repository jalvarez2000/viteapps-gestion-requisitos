import { database, withProjectContext } from '@repo/database';
import { ToolLoopAgent, tool } from 'ai';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────
// Requirements Extraction Agent
//
// Given the body of an email, extracts functional requirements
// grouped by functional area and persists them to the DB.
//
// The agent operates ONLY within the scope of the provided
// projectId — all tools have projectId captured in their closure.
// ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
Eres un analista de software experto en ingeniería de requisitos.
Tu tarea es leer el texto de un cliente y extraer requisitos funcionales claros y concisos.

Reglas:
- Solo extrae requisitos que el cliente mencione explícitamente.
- No inventes requisitos ni añadas supuestos.
- Agrupa los requisitos por área funcional (ej: "Autenticación", "Gestión de usuarios", "Informes").
- Para cada área funcional, crea el grupo primero y luego añade sus requisitos.
- Cada requisito debe tener un título corto (máximo 10 palabras) y una descripción clara.
- Si el cliente menciona algo que ya existe en grupos previos, úsalo en lugar de crear uno nuevo.
- Idioma de salida: español.
`.trim();

export function createRequirementsAgent(projectId: string, versionId: string) {
  return new ToolLoopAgent({
    // Routes through AI Gateway automatically
    model: 'anthropic/claude-sonnet-4.6',
    instructions: SYSTEM_PROMPT,
    tools: {
      listExistingGroups: tool({
        description:
          'Lista los grupos funcionales que ya existen en esta versión para reutilizarlos.',
        inputSchema: z.object({}),
        execute: async () => {
          return withProjectContext(projectId, (tx) =>
            tx.requirementGroup.findMany({
              where: { versionId },
              select: { id: true, name: true },
            })
          );
        },
      }),

      createGroup: tool({
        description: 'Crea un nuevo grupo funcional para agrupar requisitos relacionados.',
        inputSchema: z.object({
          name: z.string().describe('Nombre del área funcional, ej: "Gestión de usuarios"'),
          description: z
            .string()
            .optional()
            .describe('Descripción breve del área funcional'),
        }),
        execute: async ({ name, description }) => {
          return withProjectContext(projectId, (tx) =>
            tx.requirementGroup.upsert({
              where: { versionId_name: { versionId, name } },
              create: { projectId, versionId, name, description },
              update: {},
              select: { id: true, name: true },
            })
          );
        },
      }),

      createRequirement: tool({
        description: 'Crea un requisito funcional dentro de un grupo.',
        inputSchema: z.object({
          groupId: z.string().describe('ID del grupo funcional obtenido de createGroup o listExistingGroups'),
          title: z.string().describe('Título corto del requisito (máximo 10 palabras)'),
          description: z.string().describe('Descripción detallada del requisito'),
        }),
        execute: async ({ groupId, title, description }) => {
          return withProjectContext(projectId, (tx) =>
            tx.requirement.create({
              data: {
                projectId,
                versionId,
                groupId,
                title,
                description,
                status: 'PENDING',
              },
              select: { id: true, title: true },
            })
          );
        },
      }),
    },
  });
}

export async function extractRequirementsFromEmail({
  projectId,
  versionId,
  emailBody,
  sourceEmailId,
}: {
  projectId: string;
  versionId: string;
  emailBody: string;
  sourceEmailId: string;
}): Promise<{ groupsCreated: number; requirementsCreated: number }> {
  const agent = createRequirementsAgent(projectId, versionId);

  await agent.generate({
    prompt: `Analiza el siguiente texto del cliente y extrae los requisitos funcionales:\n\n---\n${emailBody}\n---`,
  });

  // Count what was created
  const [groupCount, reqCount] = await withProjectContext(projectId, async (tx) => {
    const groups = await tx.requirementGroup.count({ where: { versionId } });
    const reqs = await tx.requirement.count({
      where: { versionId, sourceEmailId },
    });
    return [groups, reqs];
  });

  return { groupsCreated: groupCount, requirementsCreated: reqCount };
}
