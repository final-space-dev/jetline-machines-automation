import { TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";

/** A fact that cannot be edited here: its label over its value. Empty reads "Not set"; true and false read Yes and No. */
export function ReadField({ label, value, className }: { label: string; value: React.ReactNode | boolean | null | undefined; className?: string }) {
  const empty = value === null || value === undefined || value === "";
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className={TYPE.label}>{label}</span>
      <span className={cn(TYPE.data, "min-w-0 break-words font-medium", empty || value === false ? "text-muted-foreground" : "text-foreground")}>
        {empty ? "Not set" : value === true ? "Yes" : value === false ? "No" : value}
      </span>
    </div>
  );
}
