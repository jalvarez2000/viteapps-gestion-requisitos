"use client";

import { Input } from "@repo/design-system/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/design-system/components/ui/select";
import { SearchIcon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

export function ProjectsFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const update = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete("_"); // reset pagination if added later
      startTransition(() => router.replace(`?${params.toString()}`));
    },
    [router, searchParams]
  );

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative min-w-52 flex-1">
        <SearchIcon className="-translate-y-1/2 absolute top-1/2 left-3 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          className="pl-8"
          defaultValue={searchParams.get("q") ?? ""}
          onChange={(e) => update("q", e.target.value)}
          placeholder="Buscar por nombre o código…"
        />
      </div>

      <Select
        defaultValue={searchParams.get("size") ?? "all"}
        onValueChange={(v) => update("size", v)}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Talla" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las tallas</SelectItem>
          <SelectItem value="XS">XS</SelectItem>
          <SelectItem value="S">S</SelectItem>
          <SelectItem value="M">M</SelectItem>
          <SelectItem value="L">L</SelectItem>
          <SelectItem value="XL">XL</SelectItem>
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get("version") ?? "all"}
        onValueChange={(v) => update("version", v)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Estado versión" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Cualquier versión</SelectItem>
          <SelectItem value="OPEN">Abierta</SelectItem>
          <SelectItem value="FROZEN">Congelada</SelectItem>
          <SelectItem value="TAGGED">Publicada</SelectItem>
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get("subscription") ?? "all"}
        onValueChange={(v) => update("subscription", v)}
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Suscripción" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Cualquier suscripción</SelectItem>
          <SelectItem value="active">Activa</SelectItem>
          <SelectItem value="inactive">Sin suscripción</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
