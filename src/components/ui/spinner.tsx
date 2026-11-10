import { cn } from "@/lib/ui/utils";

/**
 * Spec §3.8 spinner: 13px circle, 2px border at 40% of the context color with
 * a solid top arc, spin .7s linear. Colors ride currentColor so the spinner
 * tints itself: Signal blue by default, white inside solid buttons via
 * className="text-white", etc.
 */
export function Spinner({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      style={{
        borderColor: "color-mix(in srgb, currentColor 40%, transparent)",
        borderTopColor: "currentColor",
      }}
      className={cn(
        "animate-spin-fast size-[13px] shrink-0 rounded-full border-2 text-[#2A5BD7]",
        className
      )}
    />
  );
}
