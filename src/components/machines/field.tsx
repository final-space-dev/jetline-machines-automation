import { Label } from "@/components/ui/label";
import { TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";

/** A label, its control, an optional hint, and what to do when the value is refused. */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  className,
  children,
}: {
  label: React.ReactNode;
  htmlFor?: string;
  error?: string | null;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className={cn(TYPE.micro, "text-muted-foreground")}>{hint}</p>}
      {error && <p className={cn(TYPE.micro, "text-destructive")}>{error}</p>}
    </div>
  );
}
