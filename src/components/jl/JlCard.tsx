import type { ReactNode } from "react";

export interface JlCardProps {
  title?: ReactNode;
  actions?: ReactNode;
  hero?: boolean;
  interactive?: boolean;
  padLg?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Core surface. div.jl-card with optional modifiers and a head row
 * (jl-card__title + actions).
 */
export function JlCard({
  title,
  actions,
  hero,
  interactive,
  padLg,
  className,
  children,
}: JlCardProps) {
  const cls = [
    "jl-card",
    hero ? "jl-card--hero" : "",
    interactive ? "jl-card--interactive" : "",
    padLg ? "jl-card--pad-lg" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      {title || actions ? (
        <div className="jl-card__head">
          {title ? <div className="jl-card__title">{title}</div> : <span />}
          {actions}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export default JlCard;
