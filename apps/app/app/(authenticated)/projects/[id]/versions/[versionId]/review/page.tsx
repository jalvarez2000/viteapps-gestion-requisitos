import { database } from "@repo/database";
import { ChevronRightIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ReviewPanel } from "./components/review-panel";

interface Props {
  params: Promise<{ id: string; versionId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, versionId } = await params;
  const version = await database.version.findUnique({
    where: { id: versionId },
    include: { project: { select: { name: true } } },
  });
  return {
    title: version
      ? `Revisar v${version.number} — ${version.project.name}`
      : "Revisión",
  };
}

export default async function ReviewPage({ params }: Props) {
  const { id, versionId } = await params;

  const version = await database.version.findUnique({
    where: { id: versionId },
    include: {
      project: { select: { id: true, name: true } },
      groups: {
        orderBy: { createdAt: "asc" },
        include: {
          requirements: { orderBy: { createdAt: "asc" } },
        },
      },
      reviewCycles: {
        where: { completedAt: null },
        orderBy: { cycleNumber: "desc" },
        take: 1,
      },
    },
  });

  if (!version) {
    notFound();
  }

  // If no open review cycle, redirect to version page
  if (version.reviewCycles.length === 0) {
    redirect(`/projects/${id}/versions/${versionId}`);
  }

  const reviewCycle = version.reviewCycles[0];
  const allRequirements = version.groups.flatMap((g) => g.requirements);
  const pending = allRequirements.filter((r) => r.status === "PENDING").length;
  const confirmed = allRequirements.filter(
    (r) => r.status === "CONFIRMED"
  ).length;
  const notImplementable = allRequirements.filter(
    (r) => r.status === "NOT_IMPLEMENTABLE"
  ).length;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-muted-foreground text-sm">
        <Link className="hover:text-foreground" href="/projects">
          Proyectos
        </Link>
        <ChevronRightIcon className="h-3 w-3" />
        <Link className="hover:text-foreground" href={`/projects/${id}`}>
          {version.project.name}
        </Link>
        <ChevronRightIcon className="h-3 w-3" />
        <Link
          className="hover:text-foreground"
          href={`/projects/${id}/versions/${versionId}`}
        >
          v{version.number}
        </Link>
        <ChevronRightIcon className="h-3 w-3" />
        <span className="font-medium text-foreground">Revisión</span>
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl">Revisión de requisitos</h1>
          <p className="text-muted-foreground text-sm">
            {version.project.name} · v{version.number} · Ciclo{" "}
            {reviewCycle.cycleNumber}
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="font-medium text-amber-600">
            {pending} pendiente(s)
          </span>
          <span className="font-medium text-green-600">
            {confirmed} confirmado(s)
          </span>
          <span className="font-medium text-red-600">
            {notImplementable} no implementable(s)
          </span>
        </div>
      </div>

      <ReviewPanel
        canComplete={pending === 0}
        groups={version.groups}
        projectId={id}
        reviewCycleId={reviewCycle.id}
        versionId={versionId}
      />
    </div>
  );
}
