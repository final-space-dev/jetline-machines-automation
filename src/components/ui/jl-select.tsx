"use client";

import { useEffect, useId, useRef, useState, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";

export interface JlSelectOption {
  value: string;
  label: string;
}

interface JlSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: JlSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

export function JlSelect({
  value,
  onChange,
  options,
  placeholder = "Select…",
  disabled = false,
  style,
}: JlSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);

  const openMenu = useCallback(() => {
    const idx = options.findIndex((o) => o.value === value);
    setActiveIndex(idx >= 0 ? idx : 0);
    setOpen(true);
  }, [options, value]);

  // Click-outside to close (DOM side-effect only)
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Keep the active option scrolled into view (DOM side-effect only)
  useEffect(() => {
    if (open && activeIndex >= 0 && listRef.current) {
      const node = listRef.current.children[activeIndex] as HTMLElement | undefined;
      node?.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeIndex]);

  const commit = useCallback(
    (idx: number) => {
      const opt = options[idx];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
      }
    },
    [options, onChange],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(options.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
        e.preventDefault();
        if (activeIndex >= 0) commit(activeIndex);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} style={{ position: "relative", ...style }}>
      <button
        type="button"
        role="combobox"
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          if (open) setOpen(false);
          else openMenu();
        }}
        onKeyDown={onKeyDown}
        style={{
          width: "100%",
          height: 40,
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          borderRadius: "var(--jl-r-sm)",
          border: "1.5px solid var(--jl-ink-200)",
          background: "var(--jl-surface)",
          fontSize: 13,
          fontFamily: "var(--jl-font)",
          color: selected ? "var(--jl-ink-900)" : "var(--jl-ink-400)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          outline: "none",
          textAlign: "left",
          transition: "border-color var(--jl-t-fast) var(--jl-ease)",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: selected ? 600 : 500,
          }}
        >
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={15}
          style={{
            color: "var(--jl-ink-400)",
            flexShrink: 0,
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform var(--jl-t-fast) var(--jl-ease)",
          }}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 50,
            maxHeight: 280,
            overflowY: "auto",
            padding: 5,
            background: "var(--jl-surface)",
            boxShadow: "var(--jl-sh-lg)",
            borderRadius: "var(--jl-r-md)",
            border: "1px solid var(--jl-ink-100)",
          }}
        >
          {options.length === 0 ? (
            <div
              style={{
                padding: "10px 12px",
                fontSize: 12,
                color: "var(--jl-ink-400)",
                fontFamily: "var(--jl-font)",
              }}
            >
              No options
            </div>
          ) : (
            options.map((opt, idx) => {
              const isSelected = opt.value === value;
              const isActive = idx === activeIndex;
              return (
                <div
                  key={`${opt.value}-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => commit(idx)}
                  style={{
                    height: 36,
                    padding: "0 10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    borderRadius: "var(--jl-r-sm)",
                    fontSize: 13,
                    fontFamily: "var(--jl-font)",
                    fontWeight: isSelected ? 700 : 500,
                    color: isSelected ? "var(--jl-red-500)" : "var(--jl-ink-800)",
                    background: isActive ? "var(--jl-red-tint)" : "transparent",
                    cursor: "pointer",
                    transition: "background var(--jl-t-fast) var(--jl-ease)",
                  }}
                >
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {opt.label}
                  </span>
                  {isSelected && (
                    <Check size={14} style={{ color: "var(--jl-red-500)", flexShrink: 0 }} />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
