import { database, withProjectContext } from "@repo/database";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import {
  createBillingPortalSession,
  createCheckoutSession,
} from "@/app/actions/stripe";
import { NewRequirementForm } from "./new-requirement-form";
import {
  type PortalCommentData,
  type ReactionData,
  RequirementCard,
} from "./requirement-card";
import { VersionHistory } from "./version-history";

interface ReqWithDetails {
  description: string;
  group: { name: string };
  id: string;
  portalComments: PortalCommentData[];
  reactions: ReactionData[];
  reviewComment: string | null;
  status: string;
  title: string;
}

interface Props {
  params: Promise<{ code: string }>;
}

export default async function PortalProjectPage({ params }: Props) {
  const session = await getPortalSession();
  const { code } = await params;

  const normalizedCode = code.toUpperCase();

  if (!session || session.projectCode !== normalizedCode) {
    redirect(`/portal/login?code=${normalizedCode}`);
  }

  const project = await database.project.findUnique({
    where: { code: normalizedCode },
    select: {
      id: true,
      code: true,
      name: true,
      userSize: true,
      subscriptionStatus: true,
      stripeCustomerId: true,
      versions: {
        where: { status: "OPEN" },
        orderBy: { number: "desc" },
        take: 1,
      },
    },
  });

  if (!project) {
    redirect("/portal/login");
  }

  const version = project.versions[0];

  let requirements: ReqWithDetails[] = [];

  if (version) {
    requirements = (await withProjectContext(project.id, (tx) =>
      tx.requirement.findMany({
        where: { versionId: version.id },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          reviewComment: true,
          group: { select: { name: true } },
          portalComments: {
            select: { id: true, author: true, body: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          },
          reactions: { select: { emoji: true } },
        },
        orderBy: { createdAt: "asc" },
      })
    )) as ReqWithDetails[];
  }

  const grouped = requirements.reduce<Record<string, ReqWithDetails[]>>(
    (acc, req) => {
      const key = req.group.name;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(req);
      return acc;
    },
    {}
  );

  const historicalVersions = await withProjectContext(project.id, (tx) =>
    tx.version.findMany({
      where: { projectId: project.id, status: { in: ["FROZEN", "TAGGED"] } },
      orderBy: { number: "desc" },
      select: {
        id: true,
        number: true,
        status: true,
        tagName: true,
        groups: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            requirements: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                title: true,
                description: true,
                status: true,
                reviewComment: true,
              },
            },
          },
        },
      },
    })
  );

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const portalUrl = `${appUrl}/portal/${normalizedCode}`;
  const isActive =
    project.subscriptionStatus === "active" ||
    project.subscriptionStatus === "trialing";

  const checkoutAction = createCheckoutSession.bind(null, normalizedCode);
  const billingAction = createBillingPortalSession.bind(
    null,
    normalizedCode,
    portalUrl
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      {/* Cabecera */}
      <div className="mb-8 border-slate-200 border-b pb-6">
        <p className="mb-1 font-medium font-mono text-slate-400 text-xs uppercase tracking-widest">
          {project.code}
        </p>
        <h1 className="font-bold text-3xl text-slate-900">{project.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {version && (
            <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-0.5 font-medium text-blue-700 text-xs">
              Versión {version.number}
            </span>
          )}
          {project.userSize && (
            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-0.5 font-medium text-slate-600 text-xs">
              Talla {project.userSize}
            </span>
          )}
        </div>
      </div>

      {/* Banner de suscripción */}
      {isActive ? (
        <div className="mb-8 flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            <p className="font-medium text-green-800 text-sm">
              Suscripción activa
            </p>
          </div>
          <form action={billingAction}>
            <button
              className="text-green-700 text-xs underline underline-offset-2 hover:text-green-900"
              type="submit"
            >
              Gestionar suscripción
            </button>
          </form>
        </div>
      ) : (
        <div className="mb-8 rounded-lg border border-slate-200 bg-slate-50 px-5 py-4">
          <p className="mb-1 font-semibold text-slate-800 text-sm">
            Activa tu suscripción
          </p>
          <p className="mb-4 text-slate-500 text-sm">
            Para acceder a todas las funcionalidades de tu aplicación, activa tu
            suscripción.
          </p>
          <form action={checkoutAction}>
            <button
              className="inline-flex items-center rounded-md bg-slate-900 px-5 py-2.5 font-semibold text-sm text-white hover:bg-slate-700 focus:outline-none"
              type="submit"
            >
              Suscribirse ahora →
            </button>
          </form>
        </div>
      )}

      {/* Requisitos funcionales */}
      {Object.keys(grouped).length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-5 font-semibold text-lg text-slate-800">
            Requisitos funcionales
          </h2>
          {Object.entries(grouped).map(([group, reqs]) => (
            <div className="mb-8" key={group}>
              <h3 className="mb-3 border-slate-200 border-b pb-2 font-semibold text-slate-500 text-sm uppercase tracking-wide">
                {group}
              </h3>
              {reqs.map((req) => (
                <RequirementCard
                  comments={req.portalComments}
                  description={req.description}
                  key={req.id}
                  projectCode={normalizedCode}
                  projectId={project.id}
                  reactions={req.reactions}
                  requirementId={req.id}
                  reviewComment={req.reviewComment}
                  status={req.status}
                  title={req.title}
                />
              ))}
            </div>
          ))}
        </section>
      ) : (
        <p className="mb-8 text-slate-500 text-sm">
          Aún no se han procesado requisitos para este proyecto.
        </p>
      )}

      {/* Añadir nuevo requisito */}
      {version && (
        <NewRequirementForm
          projectCode={normalizedCode}
          projectId={project.id}
        />
      )}

      {/* Historial de versiones anteriores */}
      <VersionHistory versions={historicalVersions} />
    </div>
  );
}
