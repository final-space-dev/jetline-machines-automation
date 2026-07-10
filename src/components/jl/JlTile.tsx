import type { ReactNode } from "react";
import Link from "next/link";

export interface JlTileProps {
  icon: ReactNode;
  label: ReactNode;
  href?: string;
  onClick?: () => void;
  /** Render as the red hero launcher (jl-card--hero). */
  hero?: boolean;
}

/**
 * Launcher tile. Standard = div.jl-tile with jl-chip + jl-tile__label.
 * Hero = jl-card jl-card--hero jl-card--interactive.
 * Renders a Link when href is set, otherwise a button.
 */
export function JlTile({ icon, label, href, onClick, hero }: JlTileProps) {
  const chipCls = hero ? "jl-chip jl-chip--lg jl-tile__chip--hero" : "jl-chip";

  const content = (
    <>
      <span className={chipCls}>{icon}</span>
      <span className="jl-tile__label">{label}</span>
    </>
  );

  const cls = hero
    ? "jl-tile jl-card--hero jl-card--interactive"
    : "jl-tile";

  if (href) {
    return (
      <Link href={href} className={cls} onClick={onClick}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" className={cls} onClick={onClick}>
      {content}
    </button>
  );
}

export default JlTile;
