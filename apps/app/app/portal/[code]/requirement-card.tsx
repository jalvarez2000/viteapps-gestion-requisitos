"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { ChevronDownIcon, MessageCircleIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { addPortalComment, toggleReaction } from "./actions";

const EMOJIS = ["👍", "❤️", "🤔", "👎"] as const;

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  CONFIRMED: { label: "Confirmado", className: "bg-green-100 text-green-700" },
  NOT_IMPLEMENTABLE: {
    label: "No implementable",
    className: "bg-red-100 text-red-600",
  },
  PENDING: { label: "En revisión", className: "bg-zinc-100 text-zinc-500" },
};

export interface PortalCommentData {
  author: string;
  body: string;
  createdAt: Date;
  id: string;
}

export interface ReactionData {
  emoji: string;
}

interface Props {
  comments: PortalCommentData[];
  description: string;
  projectCode: string;
  projectId: string;
  reactions: ReactionData[];
  requirementId: string;
  reviewComment: string | null;
  status: string;
  title: string;
}

export function RequirementCard({
  projectCode,
  projectId,
  requirementId,
  title,
  description,
  status,
  reviewComment,
  comments: initialComments,
  reactions: initialReactions,
}: Props) {
  const [comments, setComments] = useState<PortalCommentData[]>(() => {
    if (reviewComment) {
      return [
        {
          id: "__review__",
          author: "admin",
          body: reviewComment,
          createdAt: new Date(0),
        },
        ...initialComments,
      ];
    }
    return initialComments;
  });
  const [reactions, setReactions] = useState(initialReactions);
  const [body, setBody] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const statusInfo = STATUS_LABELS[status] ?? STATUS_LABELS.PENDING;
  const messageCount = comments.length;

  function handleReaction(emoji: string) {
    const active = reactions.some((r) => r.emoji === emoji);
    setReactions(
      active
        ? reactions.filter((r) => r.emoji !== emoji)
        : [...reactions, { emoji }]
    );
    startTransition(() =>
      toggleReaction(projectCode, projectId, requirementId, emoji)
    );
  }

  function handleComment() {
    const trimmed = body.trim();
    if (!trimmed) {
      return;
    }
    setComments((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        author: "client",
        body: trimmed,
        createdAt: new Date(),
      },
    ]);
    setBody("");
    startTransition(() =>
      addPortalComment(projectCode, projectId, requirementId, trimmed)
    );
  }

  return (
    <div className="mb-2 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <p className="font-semibold text-slate-900 text-sm leading-snug">
          {title}
        </p>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 font-medium text-xs ${statusInfo.className}`}
        >
          {statusInfo.label}
        </span>
      </div>
      <p className="mt-0.5 text-slate-400 text-xs leading-relaxed">
        {description}
      </p>

      {/* Toggle */}
      <button
        className="mt-1.5 flex w-full items-center justify-between border-slate-100 border-t pt-1.5 text-slate-400 text-xs transition-colors hover:text-slate-600"
        onClick={() => setIsOpen((v) => !v)}
        type="button"
      >
        <span className="flex items-center gap-1">
          {messageCount > 0 ? (
            <>
              <MessageCircleIcon className="h-3 w-3" />
              <span className="font-medium text-slate-600">
                {messageCount} {messageCount === 1 ? "mensaje" : "mensajes"}
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
          {/* Chat thread */}
          {comments.length > 0 && (
            <div className="mb-2 space-y-1">
              {comments.map((c) => {
                const isAdmin = c.author === "admin";
                return (
                  <div
                    className={`flex ${isAdmin ? "justify-start" : "justify-end"}`}
                    key={c.id}
                  >
                    <div
                      className={`max-w-[80%] rounded-lg px-2.5 py-1.5 text-xs leading-snug ${
                        isAdmin
                          ? "bg-slate-100 text-slate-700"
                          : "bg-blue-500 text-white"
                      }`}
                    >
                      {isAdmin && (
                        <span className="mb-0.5 block font-semibold text-[10px] text-slate-500 uppercase tracking-wide">
                          Equipo
                        </span>
                      )}
                      {c.body}
                    </div>
                  </div>
                );
              })}

              {/* Reactions on admin review comment */}
              {reviewComment && (
                <div className="flex gap-1 pt-0.5">
                  {EMOJIS.map((emoji) => {
                    const active = reactions.some((r) => r.emoji === emoji);
                    return (
                      <button
                        className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
                          active
                            ? "border-blue-300 bg-blue-100 text-blue-700"
                            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                        }`}
                        key={emoji}
                        onClick={() => handleReaction(emoji)}
                        suppressHydrationWarning
                        type="button"
                      >
                        {emoji}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-1.5" suppressHydrationWarning>
            <input
              className="flex-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-800 text-xs placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
              disabled={isPending}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleComment()}
              placeholder="Responder…"
              suppressHydrationWarning
              value={body}
            />
            <Button
              className="h-7 px-3 text-xs"
              disabled={isPending || !body.trim()}
              onClick={handleComment}
              size="sm"
              suppressHydrationWarning
              variant="outline"
            >
              Enviar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
