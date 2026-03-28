"use client";

import { Button } from "@repo/design-system/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@repo/design-system/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@repo/design-system/components/ui/dropdown-menu";
import { Input } from "@repo/design-system/components/ui/input";
import { Label } from "@repo/design-system/components/ui/label";
import { MoreHorizontalIcon } from "lucide-react";
import { useTransition, useState } from "react";
import { freezeVersion, freezeAndTagVersion, reopenVersion } from "@/app/actions/versions";
import type { VersionStatus } from "@repo/database";

interface VersionActionsProps {
  projectId: string;
  versionId: string;
  status: VersionStatus;
}

export function VersionActions({ projectId, versionId, status }: VersionActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [tagDialog, setTagDialog] = useState(false);
  const [tagName, setTagName] = useState("");

  if (status === "TAGGED") return null;

  function handleFreeze() {
    startTransition(() => freezeVersion(projectId, versionId));
  }

  function handleReopen() {
    startTransition(() => reopenVersion(projectId, versionId));
  }

  function handleTag() {
    if (!tagName.trim()) return;
    startTransition(async () => {
      await freezeAndTagVersion(projectId, versionId, tagName.trim());
      setTagDialog(false);
      setTagName("");
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="icon" variant="ghost" disabled={isPending}>
            <MoreHorizontalIcon className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status === "OPEN" && (
            <DropdownMenuItem onClick={handleFreeze}>
              Congelar versión
            </DropdownMenuItem>
          )}
          {status === "FROZEN" && (
            <DropdownMenuItem onClick={handleReopen}>
              Reabrir versión
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => setTagDialog(true)}
            className="text-purple-600 focus:text-purple-600"
          >
            Congelar y publicar…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={tagDialog} onOpenChange={setTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publicar versión</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Label htmlFor="tagName">Nombre de etiqueta (ej: 1.0.0)</Label>
            <Input
              id="tagName"
              placeholder="1.0.0"
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTag()}
            />
            <p className="text-xs text-muted-foreground">
              Esta acción es irreversible. La versión quedará bloqueada y se creará la siguiente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleTag} disabled={isPending || !tagName.trim()}>
              Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
