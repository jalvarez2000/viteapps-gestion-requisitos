"use client";

import { Button } from "@repo/design-system/components/ui/button";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { useState, useTransition } from "react";
import { addPortalRequirement } from "./actions";

interface Props {
  projectCode: string;
  projectId: string;
}

export function NewRequirementForm({ projectCode, projectId }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError("");
    startTransition(async () => {
      const result = await addPortalRequirement(
        projectCode,
        projectId,
        title,
        description
      );
      if (result.error) {
        setError(result.error);
      } else {
        setTitle("");
        setDescription("");
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <div className="rounded-xl border border-slate-300 border-dashed p-6 text-center">
        <p className="mb-3 text-slate-500 text-sm">
          ¿Tienes un nuevo requisito que añadir?
        </p>
        <Button onClick={() => setOpen(true)} variant="outline">
          + Añadir requisito
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 font-semibold text-lg text-slate-800">
        Nuevo requisito
      </h2>
      <div className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="req-title">Título</Label>
          <Input
            autoFocus
            disabled={isPending}
            id="req-title"
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Notificaciones por correo"
            value={title}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="req-desc">Descripción</Label>
          <textarea
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-800 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-300"
            disabled={isPending}
            id="req-desc"
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe en detalle qué necesitas…"
            rows={3}
            value={description}
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <div className="flex gap-2">
          <Button
            disabled={isPending || !title.trim() || !description.trim()}
            onClick={handleSubmit}
          >
            {isPending ? "Guardando…" : "Guardar requisito"}
          </Button>
          <Button
            onClick={() => {
              setOpen(false);
              setError("");
              setTitle("");
              setDescription("");
            }}
            variant="ghost"
          >
            Cancelar
          </Button>
        </div>
      </div>
    </div>
  );
}
