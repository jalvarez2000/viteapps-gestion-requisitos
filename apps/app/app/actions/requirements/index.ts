"use server";

import { database } from "@repo/database";
import { sendVersionSummary } from "@repo/email";
import type { GroupSummary } from "@repo/email";
import { revalidatePath } from "next/cache";

export async function reviewRequirement(
  requirementId: string,
  status: "CONFIRMED" | "NOT_IMPLEMENTABLE",
  reviewComment?: string
) {
  const req = await database.requirement.update({
    where: { id: requirementId },
    data: { status, reviewComment: reviewComment ?? null },
    select: { projectId: true, versionId: true },
  });

  revalidatePath(`/projects/${req.projectId}/versions/${req.versionId}/review`);
}

export async function completeReview(
  projectId: string,
  versionId: string,
  reviewCycleId: string
) {
  // Verify no PENDING requirements remain
  const pending = await database.requirement.count({
    where: { versionId, status: "PENDING" },
  });

  if (pending > 0) {
    throw new Error(`Quedan ${pending} requisito(s) sin revisar`);
  }

  // Load full data for email
  const [version, cycle] = await Promise.all([
    database.version.findUniqueOrThrow({
      where: { id: versionId },
      include: {
        project: { select: { name: true, clientEmail: true } },
        groups: {
          orderBy: { createdAt: "asc" },
          include: { requirements: { orderBy: { createdAt: "asc" } } },
        },
        reviewCycles: {
          where: { id: reviewCycleId },
          select: { cycleNumber: true },
        },
      },
    }),
    database.reviewCycle.update({
      where: { id: reviewCycleId },
      data: { completedAt: new Date(), emailSentAt: new Date() },
      select: { cycleNumber: true },
    }),
  ]);

  // Build email payload
  const groups: GroupSummary[] = version.groups.map((g) => ({
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

  await sendVersionSummary({
    to: version.project.clientEmail,
    props: {
      projectName: version.project.name,
      versionNumber: version.number,
      cycleNumber: cycle.cycleNumber,
      groups,
      replySubject: `COMENTARIOS A REQUISITOS VERSION EN CURSO: ${version.project.name}`,
    },
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/projects/${projectId}/versions/${versionId}/review`);

  return { projectId, versionId };
}
