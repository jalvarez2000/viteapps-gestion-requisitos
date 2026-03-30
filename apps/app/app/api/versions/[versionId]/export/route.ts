import { getAdminSession } from "@repo/auth/session";
import { database, withProjectContext } from "@repo/database";

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmado ✅",
  NOT_IMPLEMENTABLE: "No implementable ❌",
  PENDING: "Pendiente ⏳",
};

const STATUS_ORDER: Record<string, number> = {
  CONFIRMED: 0,
  PENDING: 1,
  NOT_IMPLEMENTABLE: 2,
};

interface Requirement {
  description: string;
  groupId: string;
  id: string;
  portalComments: Array<{ author: string; body: string; createdAt: Date }>;
  reviewComment: string | null;
  status: string;
  title: string;
}

interface Group {
  description: string | null;
  id: string;
  name: string;
}

function buildRequirementLines(req: Requirement): string[] {
  const lines: string[] = [];

  lines.push(`### ${req.title}`);
  lines.push("");
  lines.push(`**Estado:** ${STATUS_LABEL[req.status] ?? req.status}`);
  lines.push("");
  lines.push("**Descripción:**");
  lines.push(req.description);

  if (req.reviewComment) {
    lines.push("");
    lines.push("**Comentario de revisión:**");
    lines.push(`> ${req.reviewComment}`);
  }

  const thread = buildThread(req);
  if (thread.length > 0) {
    lines.push("");
    lines.push("**Hilo de conversación:**");
    for (const entry of thread) {
      const label = entry.author === "admin" ? "Equipo" : "Cliente";
      lines.push(`- **${label}:** ${entry.body}`);
    }
  }

  lines.push("");
  lines.push("---");
  return lines;
}

function buildThread(
  req: Requirement
): Array<{ author: string; body: string }> {
  const thread: Array<{ author: string; body: string }> = [];
  if (req.reviewComment) {
    thread.push({ author: "admin", body: req.reviewComment });
  }
  for (const c of req.portalComments) {
    if (c.author !== "admin" || c.body !== req.reviewComment) {
      thread.push(c);
    }
  }
  return thread;
}

function buildGroupLines(group: Group, reqs: Requirement[]): string[] {
  const sorted = [...reqs].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
  );

  if (sorted.length === 0) {
    return [];
  }

  const lines: string[] = [];
  lines.push("");
  lines.push(`## ${group.name}`);

  if (group.description) {
    lines.push("");
    lines.push(`_${group.description}_`);
  }

  for (const req of sorted) {
    lines.push("");
    lines.push(...buildRequirementLines(req));
  }

  return lines;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ versionId: string }> }
) {
  const session = await getAdminSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { versionId } = await params;

  const version = await database.version.findUnique({
    where: { id: versionId },
    select: {
      number: true,
      project: { select: { id: true, name: true, code: true } },
      groups: {
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, description: true },
      },
    },
  });

  if (!version) {
    return new Response("Not found", { status: 404 });
  }

  const requirements = await withProjectContext(version.project.id, (tx) =>
    tx.requirement.findMany({
      where: { versionId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        groupId: true,
        title: true,
        description: true,
        status: true,
        reviewComment: true,
        portalComments: {
          select: { author: true, body: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
    })
  );

  const reqsByGroup = new Map<string, Requirement[]>();
  for (const req of requirements) {
    const list = reqsByGroup.get(req.groupId) ?? [];
    list.push(req);
    reqsByGroup.set(req.groupId, list);
  }

  const confirmedCount = requirements.filter(
    (r) => r.status === "CONFIRMED"
  ).length;
  const pendingCount = requirements.filter(
    (r) => r.status === "PENDING"
  ).length;
  const notImplementableCount = requirements.filter(
    (r) => r.status === "NOT_IMPLEMENTABLE"
  ).length;

  const exportedAt = new Date().toLocaleString("es-ES", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const lines: string[] = [
    `# ${version.project.name} — Requisitos v${version.number}`,
    "",
    `Exportado: ${exportedAt} · Proyecto: \`${version.project.code}\` · ` +
      `${confirmedCount} confirmados · ${pendingCount} pendientes · ${notImplementableCount} no implementables`,
    "",
    "---",
  ];

  for (const group of version.groups) {
    lines.push(...buildGroupLines(group, reqsByGroup.get(group.id) ?? []));
  }

  const markdown = lines.join("\n");
  const filename = `requisitos-${version.project.code.toLowerCase()}-v${version.number}.md`;

  return new Response(markdown, {
    headers: {
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Type": "text/markdown; charset=utf-8",
    },
  });
}
