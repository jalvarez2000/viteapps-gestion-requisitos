import { database } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { FolderKanbanIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Dashboard — Gestión de Requisitos",
};

export default async function DashboardPage() {
  const projects = await database.project.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    include: {
      versions: {
        where: { status: "OPEN" },
        include: {
          _count: { select: { requirements: true } },
          reviewCycles: {
            where: { completedAt: null },
            take: 1,
          },
        },
        take: 1,
        orderBy: { number: "desc" },
      },
      _count: { select: { versions: true } },
    },
  });

  const pendingReview = projects.filter(
    (p) => (p.versions[0]?.reviewCycles.length ?? 0) > 0
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">
            Resumen de proyectos y requisitos pendientes
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/projects">Ver todos los proyectos</Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Proyectos activos</CardDescription>
            <CardTitle className="text-3xl">{projects.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pendientes de revisión</CardDescription>
            <CardTitle className="text-3xl text-amber-500">
              {pendingReview.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Con versión abierta</CardDescription>
            <CardTitle className="text-3xl">
              {projects.filter((p) => p.versions.length > 0).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Pending review */}
      {pendingReview.length > 0 && (
        <section>
          <h2 className="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
            Requieren revisión
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingReview.map((project) => (
              <Link
                href={`/projects/${project.id}/versions/${project.versions[0].id}/review`}
                key={project.id}
              >
                <Card className="cursor-pointer transition-colors hover:border-amber-400">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {project.name}
                      </CardTitle>
                      <Badge
                        className="border-amber-400 text-amber-600"
                        variant="outline"
                      >
                        Revisión pendiente
                      </Badge>
                    </div>
                    <CardDescription>
                      v{project.versions[0].number} ·{" "}
                      {project.versions[0]._count.requirements} requisito(s)
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* All projects */}
      <section>
        <h2 className="mb-3 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
          Todos los proyectos
        </h2>
        {projects.length === 0 ? (
          <Card className="flex flex-col items-center justify-center py-12">
            <FolderKanbanIcon className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground text-sm">
              Aún no hay proyectos. Envía un correo con el formato{" "}
              <code className="font-mono text-xs">NUEVA APP: NOMBRE</code>
            </p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Link href={`/projects/${project.id}`} key={project.id}>
                <Card className="cursor-pointer transition-colors hover:border-primary/50">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">
                        {project.name}
                      </CardTitle>
                      {project.versions[0] && (
                        <VersionBadge status={project.versions[0].status} />
                      )}
                    </div>
                    <CardDescription>
                      {project._count.versions} versión(es) ·{" "}
                      {project.versions[0]
                        ? `v${project.versions[0].number} abierta`
                        : "sin versión abierta"}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
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
