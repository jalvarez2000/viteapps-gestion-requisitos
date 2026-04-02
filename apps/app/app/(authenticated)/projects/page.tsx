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
    status?: string;
  }>;
}

function subscriptionFilter(subscription: string | undefined) {
  if (subscription === "active") {
    return [{ subscriptionStatus: { in: ["active", "trialing"] } }];
  }
  if (subscription === "inactive") {
    return [
      {
        OR: [
          { subscriptionStatus: null },
          { subscriptionStatus: { notIn: ["active", "trialing"] } },
        ],
      },
    ];
  }
  return [];
}

export default async function ProjectsPage({ searchParams }: Props) {
  const { q, size, version, subscription, status } = await searchParams;

  const projectsWhere = {
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
      status && status !== "all" ? { status: status as never } : {},
      ...subscriptionFilter(subscription),
    ],
  };

  const [totalActive, pendingReviewCount, withOpenVersionCount, projects] =
    await Promise.all([
      database.project.count({ where: { active: true } }),
      database.project.count({
        where: {
          active: true,
          versions: {
            some: {
              status: "OPEN",
              reviewCycles: { some: { completedAt: null } },
            },
          },
        },
      }),
      database.project.count({
        where: { active: true, versions: { some: { status: "OPEN" } } },
      }),
      database.project.findMany({
        orderBy: { createdAt: "desc" },
        where: projectsWhere,
        include: {
          versions: {
            orderBy: { number: "desc" },
            take: 1,
            include: { _count: { select: { requirements: true } } },
          },
          _count: { select: { versions: true } },
        },
      }),
    ]);

  const hasFilters = !!(
    q ||
    (size && size !== "all") ||
    (version && version !== "all") ||
    (subscription && subscription !== "all") ||
    (status && status !== "all")
  );

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="font-bold text-2xl tracking-tight">Proyectos</h1>
        <p className="text-muted-foreground text-sm">
          {projects.length} proyecto(s)
          {hasFilters ? " encontrado(s)" : " registrado(s)"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Proyectos activos</CardDescription>
            <CardTitle className="text-3xl">{totalActive}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pendientes de revisión</CardDescription>
            <CardTitle className="text-3xl text-amber-500">
              {pendingReviewCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Con versión abierta</CardDescription>
            <CardTitle className="text-3xl">{withOpenVersionCount}</CardTitle>
          </CardHeader>
        </Card>
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
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-muted-foreground text-xs uppercase tracking-widest">
                        {project.code}
                      </p>
                      <CardTitle className="text-base">{project.name}</CardTitle>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <ProjectStatusBadge status={project.status} />
                      {project.versions[0] && (
                        <VersionBadge status={project.versions[0].status} />
                      )}
                    </div>
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

function ProjectStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    SOLICITADO: { label: "Solicitado", className: "border-slate-400 text-slate-500" },
    CREANDO_ENTORNO: { label: "Creando entorno", className: "border-yellow-400 text-yellow-600" },
    ENTORNO_CONSTRUIDO: { label: "Entorno construido", className: "border-blue-400 text-blue-600" },
    CREANDO_CODIGO: { label: "Creando código", className: "border-orange-400 text-orange-600" },
    CODIGO_CREADO: { label: "Código creado", className: "border-indigo-400 text-indigo-600" },
    TESTEANDO: { label: "Testeando", className: "border-purple-400 text-purple-600" },
    TESTADO: { label: "Testado", className: "border-teal-400 text-teal-600" },
    SUBIDO_A_STAGING: { label: "En staging", className: "border-green-500 text-green-600" },
  };
  const entry = map[status] ?? { label: status, className: "" };
  return (
    <Badge className={entry.className} variant="outline">
      {entry.label}
    </Badge>
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
