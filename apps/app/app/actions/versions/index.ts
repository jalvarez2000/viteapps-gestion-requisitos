"use server";

import { database } from "@repo/database";
import { revalidatePath } from "next/cache";

export async function freezeVersion(projectId: string, versionId: string) {
  const version = await database.version.findUnique({
    where: { id: versionId },
    select: { status: true, number: true, projectId: true },
  });

  if (!version || version.status !== "OPEN") {
    throw new Error("Solo se pueden congelar versiones abiertas");
  }

  await database.$transaction([
    database.version.update({
      where: { id: versionId },
      data: { status: "FROZEN", frozenAt: new Date() },
    }),
    database.version.create({
      data: {
        projectId: version.projectId,
        number: version.number + 1,
        status: "OPEN",
      },
    }),
  ]);

  revalidatePath(`/projects/${projectId}`);
}

export async function reopenVersion(projectId: string, versionId: string) {
  const version = await database.version.findUnique({
    where: { id: versionId },
    select: { status: true },
  });

  if (!version || version.status !== "FROZEN") {
    throw new Error("Solo se pueden reabrir versiones congeladas (no publicadas)");
  }

  await database.version.update({
    where: { id: versionId },
    data: { status: "OPEN", frozenAt: null },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function freezeAndTagVersion(
  projectId: string,
  versionId: string,
  tagName: string
) {
  const version = await database.version.findUnique({
    where: { id: versionId },
    select: { status: true, number: true, projectId: true },
  });

  if (!version || !["OPEN", "FROZEN"].includes(version.status)) {
    throw new Error("Solo se pueden etiquetar versiones abiertas o congeladas");
  }

  await database.$transaction([
    database.version.update({
      where: { id: versionId },
      data: {
        status: "TAGGED",
        tagName,
        taggedAt: new Date(),
        frozenAt: version.status === "OPEN" ? new Date() : undefined,
      },
    }),
    database.version.create({
      data: {
        projectId: version.projectId,
        number: version.number + 1,
        status: "OPEN",
      },
    }),
  ]);

  revalidatePath(`/projects/${projectId}`);
}
