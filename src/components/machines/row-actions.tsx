"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** The two things a config row offers: edit it, remove it. Either may be left out. */
export function RowActions({ onEdit, onDelete, disabled }: { onEdit?: () => void; onDelete?: () => void; disabled?: boolean }) {
  return (
    <span className="inline-flex items-center justify-end gap-0.5">
      {onEdit && (
        <Button variant="ghost" size="icon-sm" aria-label="Edit" disabled={disabled} onClick={onEdit}>
          <Pencil />
        </Button>
      )}
      {onDelete && (
        <Button variant="ghost" size="icon-sm" aria-label="Delete" disabled={disabled} onClick={onDelete} className="text-destructive">
          <Trash2 />
        </Button>
      )}
    </span>
  );
}
