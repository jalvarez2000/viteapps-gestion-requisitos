import { database } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Separator } from "@repo/design-system/components/ui/separator";
import { ChevronRightIcon, ExternalLinkIcon, MailIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createBillingPortalSession } from "@/app/actions/stripe";
import { VersionActions } from "./components/version-actions";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const project = await database.project.findUnique({
    where: { id },
    select: { name: true },
  });
  return {
    title: project ? `${project.name} — Gestión de Requisitos` : "Proyecto",
  };
}

export default async function ProjectPage({ params }: Props) {
  const { id } = await params;

  const project = await database.project.findUnique({
    where: { id },
    include: {
      versions: {
        orderBy: { number: "desc" },
        include: {
          _count: {
            select: { requirements: true, groups: true },
          },
          reviewCycles: {
            orderBy: { cycleNumber: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-muted-foreground text-sm">
        <Link className="hover:text-foreground" href="/projects">
          Proyectos
        </Link>
        <ChevronRightIcon className="h-3 w-3" />
        <span className="font-medium text-foreground">{project.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="mb-0.5 font-mono text-muted-foreground text-xs uppercase tracking-widest">
            {project.code}
          </p>
          <h1 className="font-bold text-2xl tracking-tight">{project.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-muted-foreground text-sm">
            <span className="flex items-center gap-1.5">
              <MailIcon className="h-3 w-3" />
              {project.clientEmail || "Sin email de cliente"}
            </span>
            {project.userSize && (
              <Badge variant="secondary">Talla {project.userSize}</Badge>
            )}
          </div>
          {project.description && (
            <p className="mt-2 text-muted-foreground text-sm">
              {project.description}
            </p>
          )}
        </div>
      </div>

      <Separator />

      {/* Suscripción */}
      <SubscriptionSection
        code={project.code}
        customerId={project.stripeCustomerId}
        status={project.subscriptionStatus}
      />

      <Separator />

      {/* Versions */}
      <div>
        <h2 className="mb-4 font-semibold">Versiones</h2>
        {project.versions.length === 0 ? (
          <Card className="py-8 text-center">
            <p className="text-muted-foreground text-sm">
              No hay versiones. Se creará la primera al recibir el primer email
              de requisitos.
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {project.versions.map((version) => {
              const hasPendingReview =
                version.reviewCycles.length > 0 &&
                !version.reviewCycles[0].completedAt;

              return (
                <Card key={version.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-base">
                          v{version.number}
                          {version.tagName && (
                            <span className="ml-2 font-normal text-muted-foreground text-sm">
                              ({version.tagName})
                            </span>
                          )}
                        </CardTitle>
                        <VersionBadge status={version.status} />
                        {hasPendingReview && (
                          <Badge
                            className="border-amber-400 text-amber-600"
                            variant="outline"
                          >
                            Revisión pendiente
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {hasPendingReview && (
                          <Button asChild size="sm">
                            <Link
                              href={`/projects/${id}/versions/${version.id}/review`}
                            >
                              Revisar requisitos
                            </Link>
                          </Button>
                        )}
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/projects/${id}/versions/${version.id}`}>
                            Ver requisitos
                          </Link>
                        </Button>
                        <VersionActions
                          projectId={id}
                          status={version.status}
                          versionId={version.id}
                          versionNumber={version.number}
                        />
                      </div>
                    </div>
                    <CardDescription>
                      {version._count.groups} grupo(s) ·{" "}
                      {version._count.requirements} requisito(s)
                      {version.frozenAt &&
                        ` · Congelada ${new Date(version.frozenAt).toLocaleDateString("es-ES")}`}
                      {version.taggedAt &&
                        ` · Publicada ${new Date(version.taggedAt).toLocaleDateString("es-ES")}`}
                    </CardDescription>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

async function SubscriptionSection({
  code,
  status,
  customerId,
}: {
  code: string;
  status: string | null;
  customerId: string | null;
}) {
  const isActive = status === "active" || status === "trialing";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const returnUrl = `${appUrl}/projects`;

  const billingAction = customerId
    ? createBillingPortalSession.bind(null, code, returnUrl)
    : undefined;

  return (
    <div>
      <h2 className="mb-3 font-semibold">Suscripción</h2>
      <div className="flex items-center gap-3">
        {isActive && (
          <Badge className="border-green-500 text-green-600" variant="outline">
            Activa
          </Badge>
        )}
        {!isActive && (
          <Badge
            className={status ? "border-amber-500 text-amber-600" : ""}
            variant="outline"
          >
            {status ?? "Sin suscripción"}
          </Badge>
        )}
        {billingAction && (
          <form action={billingAction}>
            <Button size="sm" type="submit" variant="outline">
              <ExternalLinkIcon className="mr-1.5 h-3 w-3" />
              Ver en Stripe
            </Button>
          </form>
        )}
      </div>
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
