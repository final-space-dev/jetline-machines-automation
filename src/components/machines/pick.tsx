"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type PickOption = { value: string; label: string };

/**
 * One choice from a short list: the kit Select with its options as data. An
 * empty value shows the placeholder. For a long list a person must search,
 * use the kit SearchSelect.
 */
export function Pick({
  id,
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled,
  size,
  className,
  "aria-label": ariaLabel,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: PickOption[];
  placeholder?: string;
  disabled?: boolean;
  size?: "sm" | "default";
  className?: string;
  "aria-label"?: string;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? "")} disabled={disabled}>
      <SelectTrigger id={id} size={size} aria-label={ariaLabel} className={className ?? "w-full"}>
        <SelectValue>{selected ? selected.label : <span className="text-muted-foreground">{placeholder}</span>}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value || "_none"} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
