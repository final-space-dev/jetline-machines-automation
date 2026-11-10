"use client";

import * as React from "react";
import { CalendarDays, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const toDate = (day: string | null | undefined) => {
  if (!day) return undefined;
  const [y, m, d] = day.slice(0, 10).split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
};
const toDay = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const show = (date: Date) => date.toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

/** A calendar day ("YYYY-MM-DD") picked from the kit Calendar; never a native date input. */
export function DayField({
  id,
  value,
  onChange,
  clearable = true,
  placeholder = "Choose a date",
  disabled,
  className,
}: {
  id?: string;
  value: string | null | undefined;
  onChange: (day: string | null) => void;
  clearable?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = toDate(value);
  return (
    <div className={className ?? "flex items-center gap-1.5"}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger render={<Button id={id} variant="outline" disabled={disabled} className="h-8 flex-1 justify-start px-2.5 font-normal" />}>
          <CalendarDays />
          {selected ? show(selected) : placeholder}
        </PopoverTrigger>
        <PopoverContent align="start">
          <Calendar
            mode="single"
            selected={selected}
            defaultMonth={selected}
            captionLayout="dropdown"
            onSelect={(date: Date | undefined) => {
              onChange(date ? toDay(date) : null);
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {clearable && value && !disabled && (
        <Button variant="ghost" size="icon-sm" aria-label="Clear the date" onClick={() => onChange(null)}>
          <X />
        </Button>
      )}
    </div>
  );
}
