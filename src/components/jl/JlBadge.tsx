import type { ReactNode } from "react";

export type JlTone =
  | "neutral"
  | "red"
  | "green"
  | "amber"
  | "blue"
  | "solid"
  | "dark";

export interface JlBadgeProps {
  tone?: JlTone;
  className?: string;
  children?: ReactNode;
}

/** span.jl-badge with tone modifier. Plain (neutral) has no modifier. */
export function JlBadge({ tone = "neutral", className, children }: JlBadgeProps) {
  const cls = [
    "jl-badge",
    tone === "neutral" ? "" : `jl-badge--${tone}`,
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return <span className={cls}>{children}</span>;
}

export type JlDotTone = "green" | "red" | "amber" | "blue" | "gray";

export interface JlDotProps {
  tone: JlDotTone;
  className?: string;
}

/** span.jl-dot--tone status dot. */
export function JlDot({ tone, className }: JlDotProps) {
  const cls = ["jl-dot", `jl-dot--${tone}`, className ?? ""]
    .filter(Boolean)
    .join(" ");
  return <span className={cls} />;
}

export default JlBadge;
