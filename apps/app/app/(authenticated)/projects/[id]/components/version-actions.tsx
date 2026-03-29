"use client";

import type { VersionStatus } from "@repo/database";
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
import { useState, useTransition } from "react";
import {
  freezeAndTagVersion,
  freezeVersion,
  reopenVersion,
} from "@/app/actions/versions";

interface VersionActionsProps {
  projectId: string;
  status: VersionStatus;
  versionId: string;
}

export function VersionActions({
  projectId,
  versionId,
  status,
}: VersionActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [tagDialog, setTagDialog] = useState(false);
  const [tagName, setTagName] = useState("");

  if (status === "TAGGED") {
    return null;
  }

  function handleFreeze() {
    startTransition(() => freezeVersion(projectId, versionId));
  }

  function handleReopen() {
    startTransition(() => reopenVersion(projectId, versionId));
  }

  function handleTag() {
    if (!tagName.trim()) {
      return;
    }
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
          <Button disabled={isPending} size="icon" variant="ghost">
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
            className="text-purple-600 focus:text-purple-600"
            onClick={() => setTagDialog(true)}
          >
            Congelar y publicar…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog onOpenChange={setTagDialog} open={tagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publicar versión</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <Label htmlFor="tagName">Nombre de etiqueta (ej: 1.0.0)</Label>
            <Input
              id="tagName"
              onChange={(e) => setTagName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTag()}
              placeholder="1.0.0"
              value={tagName}
            />
            <p className="text-muted-foreground text-xs">
              Esta acción es irreversible. La versión quedará bloqueada y se
              creará la siguiente.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setTagDialog(false)} variant="outline">
              Cancelar
            </Button>
            <Button disabled={isPending || !tagName.trim()} onClick={handleTag}>
              Publicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
