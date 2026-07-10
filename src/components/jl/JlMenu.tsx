"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { JlButton } from "./JlButton";

export interface JlMenuItem {
  label: ReactNode;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
}

export interface JlMenuProps {
  /** Trigger label. Defaults to "Actions" with a chevron. */
  trigger?: ReactNode;
  items: JlMenuItem[];
  /** Align the menu to the right edge of the trigger. */
  align?: "left" | "right";
}

/** div.jl-dropdown with a JlButton trigger + div.jl-menu (state + click-outside). */
export function JlMenu({ trigger, items, align = "left" }: JlMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const menuCls = ["jl-menu", align === "right" ? "jl-menu--right" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="jl-dropdown" ref={ref}>
      <JlButton
        variant="secondary"
        icon={<ChevronDown />}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        {trigger ?? "Actions"}
      </JlButton>
      <div className={menuCls} role="menu" {...(open ? { "data-open": "" } : null)}>
        {items.map((item, i) => (
          <button
            key={i}
            type="button"
            role="menuitem"
            className={
              item.danger ? "jl-menu__item jl-menu__item--danger" : "jl-menu__item"
            }
            onClick={() => {
              setOpen(false);
              item.onClick();
            }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default JlMenu;
