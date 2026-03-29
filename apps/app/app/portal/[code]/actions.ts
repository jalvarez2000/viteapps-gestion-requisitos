"use server";

import { database, withProjectContext } from "@repo/database";
import { revalidatePath } from "next/cache";
import { getPortalSession } from "@/lib/portal-session";

async function resolveSession(projectCode: string) {
  const session = await getPortalSession();
  if (!session || session.projectCode !== projectCode.toUpperCase()) {
    throw new Error("No autorizado");
  }
  return session;
}

export async function addPortalComment(
  projectCode: string,
  projectId: string,
  requirementId: string,
  body: string
): Promise<void> {
  await resolveSession(projectCode);
  const trimmed = body.trim();
  if (!trimmed) {
    return;
  }

  await withProjectContext(projectId, (tx) =>
    tx.portalComment.create({
      data: { projectId, requirementId, body: trimmed },
      select: { id: true },
    })
  );

  revalidatePath(`/portal/${projectCode}`);
}

const CLIENT_GROUP_NAME = "Solicitudes del cliente";

export async function addPortalRequirement(
  projectCode: string,
  projectId: string,
  title: string,
  description: string
): Promise<{ error?: string }> {
  await resolveSession(projectCode);

  const trimmedTitle = title.trim();
  const trimmedDesc = description.trim();
  if (!trimmedTitle) {
    return { error: "El título es obligatorio." };
  }
  if (!trimmedDesc) {
    return { error: "La descripción es obligatoria." };
  }

  const version = await database.version.findFirst({
    where: { projectId, status: "OPEN" },
    orderBy: { number: "desc" },
    select: { id: true },
  });

  if (!version) {
    return { error: "No hay una versión abierta para este proyecto." };
  }

  const existingGroup = await withProjectContext(projectId, (tx) =>
    tx.requirementGroup.findUnique({
      where: {
        versionId_name: { versionId: version.id, name: CLIENT_GROUP_NAME },
      },
      select: { id: true },
    })
  );

  const group =
    existingGroup ??
    (await withProjectContext(projectId, (tx) =>
      tx.requirementGroup.create({
        data: { projectId, versionId: version.id, name: CLIENT_GROUP_NAME },
        select: { id: true },
      })
    ));

  await withProjectContext(projectId, (tx) =>
    tx.requirement.create({
      data: {
        projectId,
        versionId: version.id,
        groupId: group.id,
        title: trimmedTitle,
        description: trimmedDesc,
        status: "PENDING",
      },
      select: { id: true },
    })
  );

  revalidatePath(`/portal/${projectCode}`);
  return {};
}

export async function toggleReaction(
  projectCode: string,
  projectId: string,
  requirementId: string,
  emoji: string
): Promise<void> {
  await resolveSession(projectCode);

  const existing = await withProjectContext(projectId, (tx) =>
    tx.requirementReaction.findUnique({
      where: { requirementId_emoji: { requirementId, emoji } },
      select: { id: true },
    })
  );

  if (existing) {
    await withProjectContext(projectId, (tx) =>
      tx.requirementReaction.delete({
        where: { requirementId_emoji: { requirementId, emoji } },
      })
    );
  } else {
    await withProjectContext(projectId, (tx) =>
      tx.requirementReaction.create({
        data: { projectId, requirementId, emoji },
        select: { id: true },
      })
    );
  }

  revalidatePath(`/portal/${projectCode}`);
}
