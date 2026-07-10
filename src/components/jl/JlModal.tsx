"use client";

import { useEffect, type ReactNode } from "react";

export interface JlModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
}

/**
 * div.jl-overlay[data-open] > div.jl-modal. Closes on Escape and backdrop click.
 * Returns null when closed so it stays out of the tree.
 */
export function JlModal({ open, onClose, title, children, footer }: JlModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="jl-overlay"
      data-open=""
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="jl-modal" role="dialog" aria-modal="true">
        <div className="jl-modal__title">{title}</div>
        {children ? <p className="jl-modal__text">{children}</p> : null}
        {footer ? <div className="jl-modal__foot">{footer}</div> : null}
      </div>
    </div>
  );
}

export default JlModal;
