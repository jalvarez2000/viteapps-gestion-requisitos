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
import {
  CheckIcon,
  ChevronDownIcon,
  MessageCircleIcon,
  SendIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addAdminPortalComment,
  completeReview,
  reviewRequirement,
} from "@/app/actions/requirements";

interface PortalCommentItem {
  author: string;
  body: string;
  createdAt: Date;
  id: string;
}

interface RequirementWithComments extends Requirement {
  portalComments: PortalCommentItem[];
}

interface GroupWithRequirements extends RequirementGroup {
  requirements: RequirementWithComments[];
}

interface ReviewPanelProps {
  canComplete: boolean;
  groups: GroupWithRequirements[];
  projectId: string;
  reviewCycleId: string;
  versionId: string;
}

interface RequirementItemProps {
  isOpen: boolean;
  isPending: boolean;
  onReply: (reqId: string) => void;
  onReplyDraftChange: (reqId: string, value: string) => void;
  onReviewDraftChange: (reqId: string, value: string) => void;
  onReviewSubmit: (
    reqId: string,
    status: "CONFIRMED" | "NOT_IMPLEMENTABLE"
  ) => void;
  onToggle: (reqId: string) => void;
  replyDraft: string;
  req: RequirementWithComments;
  reviewDraft: string;
}

function RequirementItem({
  req,
  isPending,
  isOpen,
  reviewDraft,
  replyDraft,
  onToggle,
  onReviewSubmit,
  onReviewDraftChange,
  onReply,
  onReplyDraftChange,
}: RequirementItemProps) {
  const thread: PortalCommentItem[] = [];
  if (req.reviewComment) {
    thread.push({
      id: "__review__",
      author: "admin",
      body: req.reviewComment,
      createdAt: new Date(0),
    });
  }
  for (const c of req.portalComments) {
    thread.push(c);
  }

  const threadCount = (req.reviewComment ? 1 : 0) + req.portalComments.length;

  return (
    <li className="rounded-lg border p-4">
      {/* Header */}
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
              onClick={() => onReviewSubmit(req.id, "CONFIRMED")}
              size="sm"
              suppressHydrationWarning
              variant="outline"
            >
              <CheckIcon className="mr-1 h-3 w-3" />
              Confirmar
            </Button>
            <Button
              className="border-red-400 text-red-600 hover:bg-red-50"
              disabled={isPending}
              onClick={() => onReviewSubmit(req.id, "NOT_IMPLEMENTABLE")}
              size="sm"
              suppressHydrationWarning
              variant="outline"
            >
              <XIcon className="mr-1 h-3 w-3" />
              Rechazar
            </Button>
          </div>
        )}
      </div>

      {/* Review comment textarea — only for pending */}
      {req.status === "PENDING" && (
        <Textarea
          className="mt-3 min-h-15 text-xs"
          onChange={(e) => onReviewDraftChange(req.id, e.target.value)}
          placeholder="Comentario opcional para el cliente..."
          suppressHydrationWarning
          value={reviewDraft}
        />
      )}

      {/* Toggle */}
      <button
        className="mt-3 flex w-full items-center justify-between border-t pt-2 text-muted-foreground text-xs transition-colors hover:text-foreground"
        onClick={() => onToggle(req.id)}
        suppressHydrationWarning
        type="button"
      >
        <span className="flex items-center gap-1">
          {threadCount > 0 ? (
            <>
              <MessageCircleIcon className="h-3 w-3" />
              <span className="font-medium text-foreground">
                {threadCount} {threadCount === 1 ? "mensaje" : "mensajes"}
              </span>
            </>
          ) : (
            <span>Comentar</span>
          )}
        </span>
        <ChevronDownIcon
          className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {/* Collapsible content */}
      {isOpen && (
        <div className="mt-2">
          {thread.length > 0 && (
            <div className="mb-2 space-y-1">
              {thread.map((c) => (
                <ChatBubble comment={c} key={c.id} />
              ))}
            </div>
          )}

          {req.status !== "PENDING" && (
            <div className="flex gap-1.5">
              <input
                className="flex-1 rounded-md border px-2.5 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                disabled={isPending}
                onChange={(e) => onReplyDraftChange(req.id, e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onReply(req.id)}
                placeholder="Responder al cliente..."
                value={replyDraft}
              />
              <Button
                className="h-7 px-3 text-xs"
                disabled={isPending || !replyDraft.trim()}
                onClick={() => onReply(req.id)}
                size="sm"
                variant="outline"
              >
                Enviar
              </Button>
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function ChatBubble({ comment }: { comment: PortalCommentItem }) {
  const isAdmin = comment.author === "admin";
  return (
    <div className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs leading-snug ${
          isAdmin ? "bg-slate-100 text-slate-700" : "bg-blue-500 text-white"
        }`}
      >
        <span
          className={`mb-0.5 block font-semibold text-[10px] uppercase tracking-wide ${isAdmin ? "text-slate-500" : "text-blue-200"}`}
        >
          {isAdmin ? "Equipo" : "Cliente"}
        </span>
        {comment.body}
      </div>
    </div>
  );
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
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [openThreads, setOpenThreads] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState(false);

  function toggleThread(reqId: string) {
    setOpenThreads((prev) => {
      const next = new Set(prev);
      if (next.has(reqId)) {
        next.delete(reqId);
      } else {
        next.add(reqId);
      }
      return next;
    });
  }

  function handleReview(
    reqId: string,
    status: "CONFIRMED" | "NOT_IMPLEMENTABLE"
  ) {
    startTransition(() =>
      reviewRequirement(reqId, status, reviewDrafts[reqId])
    );
  }

  function handleReply(reqId: string) {
    const body = replyDrafts[reqId]?.trim();
    if (!body) {
      return;
    }
    setReplyDrafts((prev) => ({ ...prev, [reqId]: "" }));
    startTransition(() =>
      addAdminPortalComment(reqId, projectId, versionId, body)
    );
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
    <div className="flex flex-col gap-4" suppressHydrationWarning>
      {groups.map((group) => (
        <Card key={group.id}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{group.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-3">
              {group.requirements.map((req) => (
                <RequirementItem
                  isOpen={openThreads.has(req.id)}
                  isPending={isPending}
                  key={req.id}
                  onReply={handleReply}
                  onReplyDraftChange={(id, val) =>
                    setReplyDrafts((prev) => ({ ...prev, [id]: val }))
                  }
                  onReviewDraftChange={(id, val) =>
                    setReviewDrafts((prev) => ({ ...prev, [id]: val }))
                  }
                  onReviewSubmit={handleReview}
                  onToggle={toggleThread}
                  replyDraft={replyDrafts[req.id] ?? ""}
                  req={req}
                  reviewDraft={reviewDrafts[req.id] ?? ""}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}

      <div className="sticky bottom-4 flex justify-end">
        <Button
          className="shadow-lg"
          disabled={!canComplete || completing}
          onClick={handleComplete}
          size="lg"
          suppressHydrationWarning
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
