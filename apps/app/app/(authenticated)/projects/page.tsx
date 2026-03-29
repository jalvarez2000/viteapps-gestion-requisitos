import { database } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
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
  title: "Proyectos — Gestión de Requisitos",
};

export default async function ProjectsPage() {
  const projects = await database.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      versions: {
        orderBy: { number: "desc" },
        take: 1,
        include: { _count: { select: { requirements: true } } },
      },
      _count: { select: { versions: true } },
    },
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Proyectos</h1>
        <p className="text-muted-foreground text-sm">
          {projects.length} proyecto(s) registrado(s)
        </p>
      </div>

      {projects.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <FolderKanbanIcon className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            Envía un correo con el asunto{" "}
            <code className="font-mono text-xs">NUEVA APP: NOMBRE</code> para
            crear el primer proyecto
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link href={`/projects/${project.id}`} key={project.id}>
              <Card className="cursor-pointer transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{project.name}</CardTitle>
                    {project.versions[0] && (
                      <VersionBadge status={project.versions[0].status} />
                    )}
                  </div>
                  <CardDescription>
                    {project._count.versions} versión(es)
                    {project.versions[0] &&
                      ` · v${project.versions[0].number} · ${project.versions[0]._count.requirements} req.`}
                  </CardDescription>
                  {project.description && (
                    <p className="mt-1 line-clamp-2 text-muted-foreground text-xs">
                      {project.description}
                    </p>
                  )}
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
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
