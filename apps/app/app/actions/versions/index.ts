"use server";

import { database, withProjectContext } from "@repo/database";
import type { GroupSummary } from "@repo/email";
import { sendVersionSummary } from "@repo/gmail";
import { revalidatePath } from "next/cache";

export async function freezeVersion(projectId: string, versionId: string) {
  const version = await database.version.findUnique({
    where: { id: versionId },
    select: { status: true, number: true, projectId: true },
  });

  if (!version || version.status !== "OPEN") {
    throw new Error("Solo se pueden congelar versiones abiertas");
  }

  await database.version.update({
    where: { id: versionId },
    data: { status: "FROZEN", frozenAt: new Date() },
  });

  await database.version.create({
    data: {
      projectId: version.projectId,
      number: version.number + 1,
      status: "OPEN",
    },
  });

  revalidatePath(`/projects/${projectId}`);
}

export async function reopenVersion(projectId: string, versionId: string) {
  const version = await database.version.findUnique({
    where: { id: versionId },
    select: { status: true },
  });

  if (!version || version.status !== "FROZEN") {
    throw new Error(
      "Solo se pueden reabrir versiones congeladas (no publicadas)"
    );
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
  tagName: string,
  appUrl?: string
) {
  const version = await database.version.findUnique({
    where: { id: versionId },
    select: {
      status: true,
      number: true,
      projectId: true,
      project: { select: { name: true, clientEmail: true, code: true } },
    },
  });

  if (!(version && ["OPEN", "FROZEN"].includes(version.status))) {
    throw new Error("Solo se pueden etiquetar versiones abiertas o congeladas");
  }

  await database.version.update({
    where: { id: versionId },
    data: {
      status: "TAGGED",
      tagName,
      taggedAt: new Date(),
      frozenAt: version.status === "OPEN" ? new Date() : undefined,
    },
  });

  // Only create the next version if coming from OPEN.
  // If already FROZEN, freezeVersion already created it.
  if (version.status === "OPEN") {
    await database.version.create({
      data: {
        projectId: version.projectId,
        number: version.number + 1,
        status: "OPEN",
      },
    });
  }

  // Send version summary email to client
  const groups = await withProjectContext(projectId, (tx) =>
    tx.requirementGroup.findMany({
      where: { versionId },
      orderBy: { createdAt: "asc" },
      include: { requirements: { orderBy: { createdAt: "asc" } } },
    })
  );

  const emailGroups: GroupSummary[] = groups.map((g) => ({
    name: g.name,
    confirmed: g.requirements
      .filter((r) => r.status === "CONFIRMED")
      .map((r) => ({
        title: r.title,
        description: r.description,
        reviewComment: r.reviewComment,
      })),
    notImplementable: g.requirements
      .filter((r) => r.status === "NOT_IMPLEMENTABLE")
      .map((r) => ({
        title: r.title,
        description: r.description,
        reviewComment: r.reviewComment,
      })),
  }));

  const appUrl_ = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const portalUrl = `${appUrl_}/portal/${version.project.code}`;

  await sendVersionSummary({
    to: version.project.clientEmail,
    props: {
      projectName: version.project.name,
      versionNumber: version.number,
      cycleNumber: 1,
      groups: emailGroups,
      portalUrl,
      appUrl,
    },
  });

  revalidatePath(`/projects/${projectId}`);
}
