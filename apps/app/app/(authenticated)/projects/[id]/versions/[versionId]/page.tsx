import { database } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { ChevronRightIcon, DownloadIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string; versionId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { versionId } = await params;
  const version = await database.version.findUnique({
    where: { id: versionId },
    include: { project: { select: { name: true } } },
  });
  return {
    title: version ? `v${version.number} — ${version.project.name}` : "Versión",
  };
}

export default async function VersionPage({ params }: Props) {
  const { id, versionId } = await params;

  const version = await database.version.findUnique({
    where: { id: versionId },
    include: {
      project: { select: { id: true, name: true } },
      groups: {
        orderBy: { createdAt: "asc" },
        include: {
          requirements: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
      reviewCycles: {
        where: { completedAt: null },
        take: 1,
      },
    },
  });

  if (!version) {
    notFound();
  }

  const totalReqs = version.groups.reduce(
    (acc, g) => acc + g.requirements.length,
    0
  );
  const confirmed = version.groups.reduce(
    (acc, g) =>
      acc + g.requirements.filter((r) => r.status === "CONFIRMED").length,
    0
  );
  const pending = version.groups.reduce(
    (acc, g) =>
      acc + g.requirements.filter((r) => r.status === "PENDING").length,
    0
  );
  const hasPendingReview = version.reviewCycles.length > 0;

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
        <span className="font-medium text-foreground">v{version.number}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-bold text-2xl">v{version.number}</h1>
          {version.tagName && (
            <span className="text-muted-foreground">({version.tagName})</span>
          )}
          <VersionBadge status={version.status} />
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a download href={`/api/versions/${versionId}/export`}>
              <DownloadIcon className="mr-2 h-4 w-4" />
              Exportar para Claude
            </a>
          </Button>
          {hasPendingReview && (
            <Button asChild>
              <Link href={`/projects/${id}/versions/${versionId}/review`}>
                Revisar requisitos
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total requisitos" value={totalReqs} />
        <StatCard
          className="text-amber-500"
          label="Pendientes"
          value={pending}
        />
        <StatCard
          className="text-green-600"
          label="Confirmados"
          value={confirmed}
        />
      </div>

      {/* Requirements by group */}
      {version.groups.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="text-muted-foreground text-sm">
            Aún no hay requisitos en esta versión.
          </p>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {version.groups.map((group) => (
            <Card key={group.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{group.name}</CardTitle>
                {group.description && (
                  <CardDescription>{group.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2">
                  {group.requirements.map((req) => (
                    <li
                      className="flex items-start gap-3 rounded-md border p-3"
                      key={req.id}
                    >
                      <RequirementBadge status={req.status} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm">{req.title}</p>
                        <p className="mt-0.5 text-muted-foreground text-xs">
                          {req.description}
                        </p>
                        {req.reviewComment && (
                          <p className="mt-1 text-muted-foreground text-xs italic">
                            Nota: {req.reviewComment}
                          </p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className={`text-3xl ${className ?? ""}`}>{value}</CardTitle>
      </CardHeader>
    </Card>
  );
}

function VersionBadge({ status }: { status: string }) {
  if (status === "OPEN") {
    return (
      <Badge className="border-green-500 text-green-600" variant="outline">
        Abierta
      </Badge>
    );
  }
  if (status === "FROZEN") {
    return (
      <Badge className="border-blue-500 text-blue-600" variant="outline">
        Congelada
      </Badge>
    );
  }
  return (
    <Badge className="border-purple-500 text-purple-600" variant="outline">
      Publicada
    </Badge>
  );
}

function RequirementBadge({ status }: { status: string }) {
  if (status === "CONFIRMED") {
    return (
      <Badge className="shrink-0 bg-green-100 text-green-700 hover:bg-green-100">
        Confirmado
      </Badge>
    );
  }
  if (status === "NOT_IMPLEMENTABLE") {
    return (
      <Badge className="shrink-0 bg-red-100 text-red-700 hover:bg-red-100">
        No implementable
      </Badge>
    );
  }
  return (
    <Badge
      className="shrink-0 border-amber-400 text-amber-600"
      variant="outline"
    >
      Pendiente
    </Badge>
  );
}
