"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { CheckIcon, ChevronDownIcon, SearchIcon } from "lucide-react";

import { cn } from "@/lib/ui/utils";

/**
 * Searchable dropdown (combobox): trigger styled like a SelectTrigger, panel
 * with a type-to-filter input. Options may be grouped. Behavior (keyboard
 * navigation, active option, selection) comes from Headless UI Combobox.
 */

export interface SearchOption {
  value: string;
  label: string;
  group?: string;
}

export function SearchSelect({
  options,
  value,
  onChange,
  placeholder = "Pick...",
  searchPlaceholder = "Type to search...",
  className,
  disabled,
  onSelectAllMatches,
  onQueryChange,
}: {
  options: SearchOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  onSelectAllMatches?: (query: string, matchedValues: string[]) => void;
  /** For lists too long to hold: the typed text, so the owner can fetch matching options. */
  onQueryChange?: (query: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = React.useState<React.CSSProperties>();

  const selected = options.find((o) => o.value === value);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) || o.group?.toLowerCase().includes(q)
    );
  }, [options, query]);

  // group-preserving render order
  const grouped = React.useMemo(() => {
    const out: { group: string | null; items: SearchOption[] }[] = [];
    for (const opt of filtered) {
      const g = opt.group ?? null;
      const last = out[out.length - 1];
      if (last && last.group === g) last.items.push(opt);
      else out.push({ group: g, items: [opt] });
    }
    return out;
  }, [filtered]);

  const onQueryChangeRef = React.useRef(onQueryChange);
  React.useEffect(() => { onQueryChangeRef.current = onQueryChange; }, [onQueryChange]);

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery("");
    onQueryChangeRef.current?.("");
  }, []);

  const position = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, 288);
    const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8));
    setStyle({
      position: "fixed",
      zIndex: 50,
      top: rect.bottom + 4,
      left,
      width,
    });
  }, []);

  React.useLayoutEffect(() => {
    if (!open) return;
    position();
    window.addEventListener("resize", position);
    window.addEventListener("scroll", position, true);
    return () => {
      window.removeEventListener("resize", position);
      window.removeEventListener("scroll", position, true);
    };
  }, [open, position]);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      close();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, close]);

  function pick(v: string | null) {
    if (v === null) return;
    onChange(v);
    close();
    triggerRef.current?.focus();
  }

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          "flex h-8 select-none items-center justify-between gap-2 rounded-[10px] border border-[#DEE0E3] bg-white px-2.5 text-[12.5px] whitespace-nowrap text-[#1B1D21] transition-[color,background-color,border-color,box-shadow,opacity] duration-[180ms] ease-standard outline-none",
          "hover:border-[#C8CACD] focus-visible:border-[#2A5BD7] focus-visible:ring-[3px] focus-visible:ring-[#E4EAFB] disabled:cursor-not-allowed disabled:border-[#ECEDEE] disabled:bg-[#F7F7F8] disabled:text-[#B4B8BF]",
          open && "border-[#2A5BD7] ring-[3px] ring-[#E4EAFB] hover:border-[#2A5BD7]",
          !selected && "text-[#696F79]",
          className
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDownIcon
          className={cn(
            "size-3.5 shrink-0 text-[#B4B8BF] transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={style}
            data-ui="front"
            className="z-50 origin-top overflow-hidden rounded-[12px] border border-[#EEEFF0] bg-white shadow-[0_12px_30px_rgba(28,25,23,0.1)] animate-pop-in"
            onKeyDownCapture={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                close();
                triggerRef.current?.focus();
              }
            }}
          >
            <Combobox<string | null> value={value} onChange={pick} immediate>
              <div className="relative border-b border-[#F1F1F2]">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[#B4B8BF]" />
                <ComboboxInput
                  autoFocus
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); onQueryChange?.(e.target.value); }}
                  placeholder={searchPlaceholder}
                  className="h-8 w-full bg-transparent pr-2.5 pl-8 text-[12.5px] text-[#1B1D21] outline-none placeholder:text-[#A8ADB5]"
                />
              </div>
              <ComboboxOptions static className="max-h-64 overflow-y-auto p-1.5">
                {grouped.map(({ group, items }, gi) => (
                  <div key={gi}>
                    {group && (
                      <p className="px-2.5 pt-1.5 pb-0.5 text-[10.5px] font-semibold tracking-[0.1em] text-[#696F79] uppercase">
                        {group}
                      </p>
                    )}
                    {items.map((opt) => (
                      <ComboboxOption
                        key={opt.value}
                        value={opt.value}
                        className="flex w-full cursor-default items-center gap-2 rounded-[9px] px-2.5 py-1.5 text-left text-[12.5px] text-[#3A3F47] select-none data-focus:bg-[#F4F4F5] data-focus:text-[#1B1D21] data-selected:font-semibold data-selected:text-[#1B1D21]"
                      >
                        <span className="flex-1 truncate">{opt.label}</span>
                        {opt.value === value && (
                          <CheckIcon className="size-3.5 shrink-0 text-[#2A5BD7]" />
                        )}
                      </ComboboxOption>
                    ))}
                  </div>
                ))}
                {onSelectAllMatches && query.trim() && filtered.length > 1 && (
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 text-[12.5px] font-semibold text-[#2148AE] bg-[#EEF2FE] hover:bg-[#E4EAFB] border-b border-[#D5E0F8] transition-colors duration-[180ms] ease-standard"
                    onClick={() => {
                      onSelectAllMatches(query.trim(), filtered.map((o) => o.value));
                      setOpen(false);
                      setQuery("");
                    }}
                  >
                    Select all {filtered.length} matches
                  </button>
                )}
                {!filtered.length && (
                  <p className="px-3 py-4 text-center text-[12.5px] text-[#696F79]">
                    Nothing matches.
                  </p>
                )}
              </ComboboxOptions>
            </Combobox>
          </div>,
          document.body
        )}
    </>
  );
}
