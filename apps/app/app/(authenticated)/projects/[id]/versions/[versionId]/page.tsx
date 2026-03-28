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
import type { Metadata } from "next";
import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string; versionId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id, versionId } = await params;
  const version = await database.version.findUnique({
    where: { id: versionId },
    include: { project: { select: { name: true } } },
  });
  return { title: version ? `v${version.number} — ${version.project.name}` : "Versión" };
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

  if (!version) notFound();

  const totalReqs = version.groups.reduce((acc, g) => acc + g.requirements.length, 0);
  const confirmed = version.groups.reduce(
    (acc, g) => acc + g.requirements.filter((r) => r.status === "CONFIRMED").length,
    0
  );
  const pending = version.groups.reduce(
    (acc, g) => acc + g.requirements.filter((r) => r.status === "PENDING").length,
    0
  );
  const hasPendingReview = version.reviewCycles.length > 0;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/projects" className="hover:text-foreground">Proyectos</Link>
        <ChevronRightIcon className="h-3 w-3" />
        <Link href={`/projects/${id}`} className="hover:text-foreground">{version.project.name}</Link>
        <ChevronRightIcon className="h-3 w-3" />
        <span className="text-foreground font-medium">v{version.number}</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">v{version.number}</h1>
          {version.tagName && <span className="text-muted-foreground">({version.tagName})</span>}
          <VersionBadge status={version.status} />
        </div>
        {hasPendingReview && (
          <Button asChild>
            <Link href={`/projects/${id}/versions/${versionId}/review`}>
              Revisar requisitos
            </Link>
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Total requisitos" value={totalReqs} />
        <StatCard label="Pendientes" value={pending} className="text-amber-500" />
        <StatCard label="Confirmados" value={confirmed} className="text-green-600" />
      </div>

      {/* Requirements by group */}
      {version.groups.length === 0 ? (
        <Card className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
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
                      key={req.id}
                      className="flex items-start gap-3 rounded-md border p-3"
                    >
                      <RequirementBadge status={req.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{req.title}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {req.description}
                        </p>
                        {req.reviewComment && (
                          <p className="mt-1 text-xs italic text-muted-foreground">
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
  if (status === "OPEN")
    return <Badge variant="outline" className="border-green-500 text-green-600">Abierta</Badge>;
  if (status === "FROZEN")
    return <Badge variant="outline" className="border-blue-500 text-blue-600">Congelada</Badge>;
  return <Badge variant="outline" className="border-purple-500 text-purple-600">Publicada</Badge>;
}

function RequirementBadge({ status }: { status: string }) {
  if (status === "CONFIRMED")
    return <Badge className="shrink-0 bg-green-100 text-green-700 hover:bg-green-100">Confirmado</Badge>;
  if (status === "NOT_IMPLEMENTABLE")
    return <Badge className="shrink-0 bg-red-100 text-red-700 hover:bg-red-100">No implementable</Badge>;
  return <Badge variant="outline" className="shrink-0 border-amber-400 text-amber-600">Pendiente</Badge>;
}
