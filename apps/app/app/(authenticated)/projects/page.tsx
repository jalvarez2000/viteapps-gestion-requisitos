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
import { Suspense } from "react";
import { ProjectsFilters } from "./projects-filters";

export const metadata: Metadata = {
  title: "Proyectos — Gestión de Requisitos",
};

interface Props {
  searchParams: Promise<{
    q?: string;
    size?: string;
    version?: string;
    subscription?: string;
  }>;
}

export default async function ProjectsPage({ searchParams }: Props) {
  const { q, size, version, subscription } = await searchParams;

  const projects = await database.project.findMany({
    orderBy: { createdAt: "desc" },
    where: {
      AND: [
        q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { code: { contains: q, mode: "insensitive" } },
              ],
            }
          : {},
        size && size !== "all" ? { userSize: size as never } : {},
        version && version !== "all"
          ? { versions: { some: { status: version as never } } }
          : {},
        ...(subscription === "active"
          ? [{ subscriptionStatus: { in: ["active", "trialing"] } }]
          : subscription === "inactive"
            ? [
                {
                  OR: [
                    { subscriptionStatus: null },
                    { subscriptionStatus: { notIn: ["active", "trialing"] } },
                  ],
                },
              ]
            : []),
      ],
    },
    include: {
      versions: {
        orderBy: { number: "desc" },
        take: 1,
        include: { _count: { select: { requirements: true } } },
      },
      _count: { select: { versions: true } },
    },
  });

  const hasFilters = !!(q || (size && size !== "all") || (version && version !== "all") || (subscription && subscription !== "all"));

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Proyectos</h1>
        <p className="text-muted-foreground text-sm">
          {projects.length} proyecto(s)
          {hasFilters ? " encontrado(s)" : " registrado(s)"}
        </p>
      </div>

      <Suspense>
        <ProjectsFilters />
      </Suspense>

      {projects.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <FolderKanbanIcon className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            {hasFilters
              ? "Ningún proyecto coincide con los filtros aplicados."
              : "Envía un correo con el asunto "}
            {!hasFilters && (
              <code className="font-mono text-xs">NUEVA APP: NOMBRE</code>
            )}
            {!hasFilters && " para crear el primer proyecto"}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link href={`/projects/${project.id}`} key={project.id}>
              <Card className="cursor-pointer transition-colors hover:border-primary/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
                        {project.code}
                      </p>
                      <CardTitle className="text-base">{project.name}</CardTitle>
                    </div>
                    {project.versions[0] && (
                      <VersionBadge status={project.versions[0].status} />
                    )}
                  </div>
                  <CardDescription>
                    {project._count.versions} versión(es)
                    {project.versions[0] &&
                      ` · v${project.versions[0].number} · ${project.versions[0]._count.requirements} req.`}
                    {project.userSize && ` · Talla ${project.userSize}`}
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
