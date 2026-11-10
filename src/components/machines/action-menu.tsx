"use client";

import * as React from "react";
import { MoreHorizontal, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export type MenuAction = {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
};

/** A short list of actions behind one button: the kit Popover holding kit Buttons. */
export function ActionMenu({
  actions,
  label = "Actions",
  trigger,
  align = "end",
}: {
  actions: MenuAction[];
  /** The trigger's accessible name. */
  label?: string;
  /** The trigger's content; the default is the three dots. */
  trigger?: React.ReactNode;
  align?: "start" | "center" | "end";
}) {
  const [open, setOpen] = React.useState(false);
  if (!actions.length) return null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant={trigger ? "outline" : "ghost"} size={trigger ? "sm" : "icon-sm"} aria-label={label} />}>{trigger ?? <MoreHorizontal />}</PopoverTrigger>
      <PopoverContent align={align} className="flex w-56 flex-col gap-0.5 p-1.5">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Button
              key={a.label}
              variant={a.destructive ? "destructive" : "ghost"}
              size="sm"
              disabled={a.disabled}
              className="w-full justify-start"
              onClick={() => {
                setOpen(false);
                a.onSelect();
              }}
            >
              {Icon && <Icon />}
              {a.label}
            </Button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
