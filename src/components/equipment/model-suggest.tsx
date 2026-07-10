"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";

interface ModelSuggestProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  /**
   * Optional equipment type filter. When provided, only catalogue models of
   * this equipment_type are suggested (passed as &type=<equipmentType>).
   * When omitted, behaves exactly as before (all models).
   */
  equipmentType?: string;
}

/**
 * Make/Model autosuggest. Debounces 300ms and queries
 * GET /api/equipment/models?q=term[&type=equipmentType] -> { models: string[] }.
 * Shows matching existing models; if the typed term isn't an exact match,
 * offers "Add new model: <term>" at the bottom to accept free text.
 */
export function ModelSuggest({
  value,
  onChange,
  placeholder = "Make / Model…",
  style,
  equipmentType,
}: ModelSuggestProps) {
  const [open, setOpen] = useState(false);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const term = value.trim();
  const type = (equipmentType ?? "").trim();
  const hasExact = models.some((m) => m.toLowerCase() === term.toLowerCase());
  const showAddNew = term.length > 0 && !hasExact;

  // Options = matching models + optional "add new" row
  const options: { value: string; isNew: boolean }[] = [
    ...models.map((m) => ({ value: m, isNew: false })),
    ...(showAddNew ? [{ value: term, isNew: true }] : []),
  ];

  // Debounced fetch (300ms)
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      setLoading(true);
      const params = new URLSearchParams({ q: term });
      if (type) params.set("type", type);
      fetch(`/api/equipment/models?${params.toString()}`)
        .then((r) => (r.ok ? r.json() : { models: [] }))
        .then((d: { models?: string[] }) => setModels(Array.isArray(d.models) ? d.models : []))
        .catch(() => setModels([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [term, type, open]);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Keep active option in view
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
    if (!open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        setActiveIndex(0);
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
      case "Enter":
        if (activeIndex >= 0 && activeIndex < options.length) {
          e.preventDefault();
          commit(activeIndex);
        } else {
          setOpen(false);
        }
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
      <div style={{ position: "relative" }}>
        <input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!open) setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          role="combobox"
          aria-controls={listId}
          aria-expanded={open}
          aria-autocomplete="list"
          style={{
            width: "100%",
            height: 36,
            padding: "0 30px 0 12px",
            borderRadius: "var(--jl-r-sm)",
            border: "1.5px solid var(--jl-ink-200)",
            fontSize: 13,
            fontFamily: "var(--jl-font)",
            color: "var(--jl-ink-900)",
            background: "var(--jl-surface)",
            outline: "none",
          }}
        />
        <ChevronDown
          size={15}
          onClick={() => setOpen((o) => !o)}
          style={{
            position: "absolute",
            right: 10,
            top: "50%",
            transform: `translateY(-50%) ${open ? "rotate(180deg)" : ""}`,
            color: "var(--jl-ink-400)",
            cursor: "pointer",
            transition: "transform var(--jl-t-fast) var(--jl-ease)",
          }}
        />
      </div>

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
          {loading && models.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--jl-ink-400)", fontFamily: "var(--jl-font)" }}>
              Searching…
            </div>
          ) : options.length === 0 ? (
            <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--jl-ink-400)", fontFamily: "var(--jl-font)" }}>
              Type to search models
            </div>
          ) : (
            options.map((opt, idx) => {
              const isActive = idx === activeIndex;
              return (
                <div
                  key={`${opt.isNew ? "new" : "m"}-${opt.value}-${idx}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(idx);
                  }}
                  style={{
                    minHeight: 36,
                    padding: "8px 10px",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    borderRadius: "var(--jl-r-sm)",
                    fontSize: 13,
                    fontFamily: "var(--jl-font)",
                    fontWeight: opt.isNew ? 700 : 500,
                    color: opt.isNew ? "var(--jl-red-500)" : "var(--jl-ink-800)",
                    background: isActive ? "var(--jl-red-tint)" : "transparent",
                    cursor: "pointer",
                    transition: "background var(--jl-t-fast) var(--jl-ease)",
                    borderTop: opt.isNew && models.length > 0 ? "1px solid var(--jl-ink-100)" : "none",
                  }}
                >
                  {opt.isNew && <Plus size={13} style={{ flexShrink: 0 }} />}
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {opt.isNew ? `Add new model: ${opt.value}` : opt.value}
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
