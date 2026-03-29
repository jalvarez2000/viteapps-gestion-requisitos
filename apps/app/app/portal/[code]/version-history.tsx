"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

const STATUS_LABELS: Record<string, { className: string; label: string }> = {
  CONFIRMED: { label: "Confirmado", className: "bg-green-100 text-green-700" },
  NOT_IMPLEMENTABLE: {
    label: "No implementable",
    className: "bg-red-100 text-red-600",
  },
  PENDING: { label: "En revisión", className: "bg-zinc-100 text-zinc-500" },
};

interface HistRequirement {
  description: string;
  id: string;
  reviewComment: string | null;
  status: string;
  title: string;
}

interface HistGroup {
  id: string;
  name: string;
  requirements: HistRequirement[];
}

interface HistVersion {
  groups: HistGroup[];
  id: string;
  number: number;
  status: string;
  tagName: string | null;
}

interface Props {
  versions: HistVersion[];
}

export function VersionHistory({ versions }: Props) {
  const [openVersions, setOpenVersions] = useState<Set<string>>(new Set());

  if (versions.length === 0) {
    return null;
  }

  function toggle(versionId: string) {
    setOpenVersions((prev) => {
      const next = new Set(prev);
      if (next.has(versionId)) {
        next.delete(versionId);
      } else {
        next.add(versionId);
      }
      return next;
    });
  }

  return (
    <section className="mt-12 border-slate-200 border-t pt-8">
      <h2 className="mb-4 font-semibold text-lg text-slate-800">
        Historial de versiones
      </h2>
      <div className="space-y-2">
        {versions.map((version) => {
          const isOpen = openVersions.has(version.id);
          const totalReqs = version.groups.reduce(
            (acc, g) => acc + g.requirements.length,
            0
          );
          const confirmedReqs = version.groups.reduce(
            (acc, g) =>
              acc +
              g.requirements.filter((r) => r.status === "CONFIRMED").length,
            0
          );
          const activeGroups = version.groups.filter(
            (g) => g.requirements.length > 0
          );

          return (
            <div
              className="rounded-lg border border-slate-200 bg-white shadow-sm"
              key={version.id}
            >
              <button
                className="flex w-full items-center justify-between px-4 py-3 text-left"
                onClick={() => toggle(version.id)}
                type="button"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-800 text-sm">
                    Versión {version.number}
                    {version.tagName && (
                      <span className="ml-1 font-normal text-slate-400">
                        — {version.tagName}
                      </span>
                    )}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-medium text-xs ${
                      version.status === "TAGGED"
                        ? "bg-purple-100 text-purple-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {version.status === "TAGGED" ? "Publicada" : "Congelada"}
                  </span>
                  <span className="text-slate-400 text-xs">
                    {confirmedReqs}/{totalReqs} confirmados
                  </span>
                </div>
                <ChevronDownIcon
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {isOpen && (
                <div className="border-slate-100 border-t px-4 pt-3 pb-4">
                  {activeGroups.length === 0 ? (
                    <p className="text-slate-400 text-xs">
                      Sin requisitos en esta versión.
                    </p>
                  ) : (
                    activeGroups.map((group) => (
                      <div className="mb-4 last:mb-0" key={group.id}>
                        <h3 className="mb-2 border-slate-100 border-b pb-1 font-semibold text-slate-500 text-xs uppercase tracking-wide">
                          {group.name}
                        </h3>
                        <div className="space-y-2">
                          {group.requirements.map((req) => {
                            const statusInfo =
                              STATUS_LABELS[req.status] ??
                              STATUS_LABELS.PENDING;
                            return (
                              <div
                                className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2"
                                key={req.id}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-medium text-slate-800 text-sm leading-snug">
                                    {req.title}
                                  </p>
                                  <span
                                    className={`shrink-0 rounded-full px-2 py-0.5 font-medium text-xs ${statusInfo.className}`}
                                  >
                                    {statusInfo.label}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-slate-400 text-xs leading-relaxed">
                                  {req.description}
                                </p>
                                {req.reviewComment && (
                                  <p className="mt-1.5 border-slate-200 border-l-2 pl-2 text-slate-500 text-xs italic">
                                    {req.reviewComment}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
