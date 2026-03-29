"use client";

import type { Requirement, RequirementGroup } from "@repo/database";
import { Badge } from "@repo/design-system/components/ui/badge";
import { Button } from "@repo/design-system/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@repo/design-system/components/ui/card";
import { Textarea } from "@repo/design-system/components/ui/textarea";
import { CheckIcon, SendIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { completeReview, reviewRequirement } from "@/app/actions/requirements";

type GroupWithRequirements = RequirementGroup & { requirements: Requirement[] };

interface ReviewPanelProps {
  canComplete: boolean;
  groups: GroupWithRequirements[];
  projectId: string;
  reviewCycleId: string;
  versionId: string;
}

export function ReviewPanel({
  groups,
  reviewCycleId,
  projectId,
  versionId,
  canComplete,
}: ReviewPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [comments, setComments] = useState<Record<string, string>>({});
  const [completing, setCompleting] = useState(false);

  function handleComment(reqId: string, value: string) {
    setComments((prev) => ({ ...prev, [reqId]: value }));
  }

  function handleReview(
    reqId: string,
    status: "CONFIRMED" | "NOT_IMPLEMENTABLE"
  ) {
    startTransition(() => reviewRequirement(reqId, status, comments[reqId]));
  }

  async function handleComplete() {
    setCompleting(true);
    try {
      await completeReview(projectId, versionId, reviewCycleId);
      router.push(`/projects/${projectId}/versions/${versionId}`);
    } finally {
      setCompleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <Card key={group.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{group.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {group.requirements.map((req) => (
                <li className="rounded-lg border p-4" key={req.id}>
                  <div className="flex items-start gap-3">
                    <RequirementBadge status={req.status} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">{req.title}</p>
                      <p className="mt-0.5 text-muted-foreground text-xs">
                        {req.description}
                      </p>
                    </div>
                    {req.status === "PENDING" && (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          className="border-green-500 text-green-600 hover:bg-green-50"
                          disabled={isPending}
                          onClick={() => handleReview(req.id, "CONFIRMED")}
                          size="sm"
                          variant="outline"
                        >
                          <CheckIcon className="mr-1 h-3 w-3" />
                          Confirmar
                        </Button>
                        <Button
                          className="border-red-400 text-red-600 hover:bg-red-50"
                          disabled={isPending}
                          onClick={() =>
                            handleReview(req.id, "NOT_IMPLEMENTABLE")
                          }
                          size="sm"
                          variant="outline"
                        >
                          <XIcon className="mr-1 h-3 w-3" />
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Comment field — always visible for pending, shown if comment exists for reviewed */}
                  {req.status === "PENDING" && (
                    <Textarea
                      className="mt-3 min-h-[60px] text-xs"
                      onChange={(e) => handleComment(req.id, e.target.value)}
                      placeholder="Comentario opcional para el cliente..."
                      value={comments[req.id] ?? ""}
                    />
                  )}
                  {req.status !== "PENDING" && req.reviewComment && (
                    <p className="mt-2 border-l-2 pl-2 text-muted-foreground text-xs italic">
                      {req.reviewComment}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      {/* Complete review button */}
      <div className="sticky bottom-4 flex justify-end">
        <Button
          className="shadow-lg"
          disabled={!canComplete || completing}
          onClick={handleComplete}
          size="lg"
        >
          <SendIcon className="mr-2 h-4 w-4" />
          {canComplete
            ? "Requisitos revisados — Enviar resumen al cliente"
            : "Revisa todos los requisitos primero"}
        </Button>
      </div>
    </div>
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
