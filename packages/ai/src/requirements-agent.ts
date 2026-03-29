import { withProjectContext } from "@repo/database";
import { generateText, Output, ToolLoopAgent, tool } from "ai";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────
// Requirements Extraction Agent
//
// Given the body of an email, extracts functional requirements
// grouped by functional area and free-form comments, and persists
// them to the DB linked to the source email.
// ─────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
Eres un analista de software experto en ingeniería de requisitos.
Tu tarea es leer el texto de un cliente y separar su contenido en dos categorías:

1. REQUISITOS FUNCIONALES — acciones o funcionalidades concretas que el sistema debe hacer.
2. COMENTARIOS — todo lo demás: preguntas, contexto, opiniones, restricciones no funcionales, saludos, aclaraciones.

Reglas para requisitos:
- Solo extrae requisitos que el cliente mencione explícitamente.
- No inventes requisitos ni añadas supuestos.
- Agrupa los requisitos por área funcional (ej: "Autenticación", "Gestión de usuarios", "Informes").
- Para cada área funcional, crea el grupo primero y luego añade sus requisitos.
- Cada requisito debe tener un título corto (máximo 10 palabras) y una descripción clara.
- Si el cliente menciona algo que ya existe en grupos previos, úsalo en lugar de crear uno nuevo.

Reglas para comentarios:
- Recoge como comentario cualquier frase que no sea un requisito funcional directo.
- Un comentario por idea o tema. No los juntes todos en uno.
- Si el correo es una respuesta a una lista de requisitos previos, recoge las observaciones sobre cada punto como comentarios individuales.

Idioma de salida: español.
`.trim();

export function createRequirementsAgent(
  projectId: string,
  versionId: string,
  emailLogId: string
) {
  return new ToolLoopAgent({
    model: "anthropic/claude-sonnet-4.6",
    instructions: SYSTEM_PROMPT,
    tools: {
      listExistingGroups: tool({
        description:
          "Lista los grupos funcionales que ya existen en esta versión para reutilizarlos.",
        inputSchema: z.object({}),
        execute: async () => {
          return await withProjectContext(projectId, (tx) =>
            tx.requirementGroup.findMany({
              where: { versionId },
              select: { id: true, name: true },
            })
          );
        },
      }),

      createGroup: tool({
        description:
          "Crea un nuevo grupo funcional para agrupar requisitos relacionados.",
        inputSchema: z.object({
          name: z
            .string()
            .describe('Nombre del área funcional, ej: "Gestión de usuarios"'),
          description: z
            .string()
            .optional()
            .describe("Descripción breve del área funcional"),
        }),
        execute: async ({ name, description }) => {
          return await withProjectContext(projectId, async (tx) => {
            const existing = await tx.requirementGroup.findFirst({
              where: { versionId, name },
              select: { id: true, name: true },
            });
            if (existing) {
              return existing;
            }
            return tx.requirementGroup.create({
              data: { projectId, versionId, name, description },
              select: { id: true, name: true },
            });
          });
        },
      }),

      createRequirement: tool({
        description: "Crea un requisito funcional dentro de un grupo.",
        inputSchema: z.object({
          groupId: z
            .string()
            .describe(
              "ID del grupo funcional obtenido de createGroup o listExistingGroups"
            ),
          title: z
            .string()
            .describe("Título corto del requisito (máximo 10 palabras)"),
          description: z
            .string()
            .describe("Descripción detallada del requisito"),
        }),
        execute: async ({ groupId, title, description }) => {
          return await withProjectContext(projectId, (tx) =>
            tx.requirement.create({
              data: {
                projectId,
                versionId,
                groupId,
                title,
                description,
                status: "PENDING",
                sourceEmailId: emailLogId,
              },
              select: { id: true, title: true },
            })
          );
        },
      }),

      addComment: tool({
        description:
          "Guarda una observación, pregunta, aclaración o cualquier texto del cliente que no sea un requisito funcional directo.",
        inputSchema: z.object({
          body: z
            .string()
            .describe(
              "Texto del comentario tal como lo expresa el cliente, en español"
            ),
        }),
        execute: async ({ body }) => {
          return await withProjectContext(projectId, (tx) =>
            tx.emailComment.create({
              data: { projectId, versionId, emailLogId, body },
              select: { id: true },
            })
          );
        },
      }),
    },
  });
}

const SIZE_DESCRIPTIONS = `
XS — Una pantalla, una función. Sin autenticación, sin base de datos, sin gestión de usuarios. Una sola acción.
S  — 3-5 pantallas, flujo lineal, zona de administración básica, sin roles múltiples.
M  — Múltiples módulos, multi-usuario con un nivel de permisos, dashboard, importación/exportación.
L  — Múltiples tipos de usuario (admin/empleado/cliente), procesos encadenados, hasta 3 integraciones externas.
XL — Varias aplicaciones comunicadas en tiempo real, alta concurrencia, más de 3 integraciones, arquitectura distribuida.
`.trim();

export type ProjectSize = "XS" | "S" | "M" | "L" | "XL";

export async function assessProjectSize(
  requirements: { group: string; title: string; description: string }[]
): Promise<ProjectSize> {
  const list = requirements
    .map((r) => `- [${r.group}] ${r.title}: ${r.description}`)
    .join("\n");

  const { output } = await generateText({
    model: "anthropic/claude-haiku-4.5",
    output: Output.object({
      schema: z.object({
        size: z.enum(["XS", "S", "M", "L", "XL"]),
      }),
    }),
    prompt: `Eres un arquitecto de software. Clasifica el proyecto en una talla (XS/S/M/L/XL) basándote en los siguientes requisitos funcionales.

Definición de tallas:
${SIZE_DESCRIPTIONS}

Requisitos:
${list}

Responde SOLO con el JSON de la talla.`,
  });

  return output.size;
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
}): Promise<{
  groupsCreated: number;
  requirementsCreated: number;
  commentsCreated: number;
  aiSize: ProjectSize;
}> {
  const agent = createRequirementsAgent(projectId, versionId, sourceEmailId);

  await agent.generate({
    prompt: `Analiza el siguiente texto del cliente. Extrae los requisitos funcionales y guarda como comentarios todo lo que no sea un requisito directo:\n\n---\n${emailBody}\n---`,
  });

  const [groupCount, reqCount, commentCount, requirements] =
    await withProjectContext(projectId, async (tx) => {
      const groups = await tx.requirementGroup.count({ where: { versionId } });
      const reqs = await tx.requirement.count({
        where: { versionId, sourceEmailId },
      });
      const comments = await tx.emailComment.count({
        where: { versionId, emailLogId: sourceEmailId },
      });
      const allReqs = await tx.requirement.findMany({
        where: { versionId },
        select: {
          title: true,
          description: true,
          group: { select: { name: true } },
        },
      });
      return [groups, reqs, comments, allReqs];
    });

  const aiSize = await assessProjectSize(
    requirements.map((r) => ({
      group: r.group.name,
      title: r.title,
      description: r.description,
    }))
  );

  return {
    groupsCreated: groupCount,
    requirementsCreated: reqCount,
    commentsCreated: commentCount,
    aiSize,
  };
}
