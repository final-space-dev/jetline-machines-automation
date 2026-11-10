"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Combobox, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react";
import { CheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";

import { cn } from "@/lib/ui/utils";
import { isPick, scopeLabelOf, scopeTokens, toggleScope, SCOPE_ALL } from "@/lib/ui/scope";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { SearchOption } from "@/components/ui/search-select";

/**
 * The Reporting face's scope filter: Holding > Group > Division > Entity >
 * Company with checkboxes, so any combination can be read together (JCP
 * Group and Jetline NSC, three stores of two entities...). The value is the
 * scope string of src/lib/scope.ts: one whole-set word (JCI Group everyone,
 * Owned, Independents - picking one resets the list) or picks joined by "~".
 *
 * Ticks are drafted while the list is open and applied when it closes (Apply,
 * Escape, a click outside), so a page reloads once for the whole selection.
 * Keyboard: type to search, arrows to move, Enter to tick, Escape to apply.
 */

/** The trigger's words for a scope: "JCP Group", "JCP Group + Jetline NSC", "JCP Group + 3 more". */
export function scopeSummary(value: string, options: readonly SearchOption[], fallback: string): string {
  const labelOf = new Map(options.map((o) => [o.value, o.label]));
  const tokens = scopeTokens(value);
  const known = tokens.map((t) => labelOf.get(t)).filter((l): l is string => !!l);
  if (known.length === tokens.length) return scopeLabelOf(known);
  if (known.length) return `${known[0]} + ${tokens.length - 1} more`;
  return tokens.length === 1 ? fallback : `${tokens.length} selected`;
}

const LEVEL: Record<string, string> = { Groups: "Group", Divisions: "Division", Entities: "Entity", Companies: "Company", Stores: "Store", Branches: "Branch" };

export function ScopePicker({
  options,
  value,
  onChange,
  placeholder = "JCI Group (everyone)",
  searchPlaceholder = "Type to search...",
  className,
  disabled,
}: {
  options: SearchOption[];
  /** the applied scope string */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [draft, setDraft] = React.useState(value);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = React.useState<React.CSSProperties>();

  const shown = open ? draft : value;
  const tokens = React.useMemo(() => scopeTokens(draft), [draft]);
  const picks = React.useMemo(() => tokens.filter(isPick), [tokens]);
  // a chip names its level when another option carries the same name (the Copper Moon division and entity)
  const chipOf = React.useMemo(() => {
    const seen = new Map<string, number>();
    for (const o of options) seen.set(o.label, (seen.get(o.label) ?? 0) + 1);
    return new Map(options.map((o) => [o.value, (seen.get(o.label) ?? 0) > 1 && o.group ? `${o.label} · ${LEVEL[o.group] ?? o.group}` : o.label]));
  }, [options]);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.group?.toLowerCase().includes(q));
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

  // the latest values for the close handlers (they run from document listeners)
  const live = React.useRef({ draft, value, onChange });
  React.useLayoutEffect(() => { live.current = { draft, value, onChange }; }, [draft, value, onChange]);

  const close = React.useCallback((apply: boolean) => {
    setOpen(false);
    setQuery("");
    const { draft: d, value: v, onChange: change } = live.current;
    if (apply && d !== v) change(d);
  }, []);

  const openPanel = () => {
    setDraft(value);
    setOpen(true);
  };

  const position = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.max(rect.width, 320);
    const left = Math.min(rect.left, Math.max(8, window.innerWidth - width - 8));
    setStyle({ position: "fixed", zIndex: 50, top: rect.bottom + 4, left, width });
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
      close(true);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, close]);

  /** One tick: a whole-set word applies at once (it is the whole list); a pick joins or leaves the draft. */
  const tick = (token: string) => {
    if (!isPick(token)) {
      live.current.draft = token;
      setDraft(token);
      close(true);
      triggerRef.current?.focus();
      return;
    }
    setDraft((d) => toggleScope(d, token));
  };

  // Headless UI hands the whole new selection; the one that changed is the tick
  const onSelection = (next: string[]) => {
    const before = new Set(tokens);
    const added = next.find((t) => !before.has(t));
    const removed = tokens.find((t) => !next.includes(t));
    const token = added ?? removed;
    if (token) tick(token);
  };

  const apply = () => {
    close(true);
    triggerRef.current?.focus();
  };

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => (open ? close(true) : openPanel())}
        className={cn(
          "flex h-8 select-none items-center justify-between gap-2 rounded-[10px] border border-[#DEE0E3] bg-white px-2.5 text-[12.5px] whitespace-nowrap text-[#1B1D21] transition-[color,background-color,border-color,box-shadow,opacity] duration-[180ms] ease-standard outline-none",
          "hover:border-[#C8CACD] focus-visible:border-[#2A5BD7] focus-visible:ring-[3px] focus-visible:ring-[#E4EAFB] disabled:cursor-not-allowed disabled:border-[#ECEDEE] disabled:bg-[#F7F7F8] disabled:text-[#B4B8BF]",
          open && "border-[#2A5BD7] ring-[3px] ring-[#E4EAFB] hover:border-[#2A5BD7]",
          className
        )}
      >
        <span className="truncate">{scopeSummary(shown, options, placeholder)}</span>
        <span className="flex shrink-0 items-center gap-1">
          {scopeTokens(shown).filter(isPick).length > 1 && (
            <span className="rounded-full bg-[#EEF2FE] px-1.5 text-[11px] leading-[18px] font-semibold text-[#2148AE] tabular-nums">
              {scopeTokens(shown).length}
            </span>
          )}
          <ChevronDownIcon className={cn("size-3.5 text-[#B4B8BF] transition-transform duration-150", open && "rotate-180")} />
        </span>
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
                apply();
              }
            }}
          >
            <Combobox value={tokens} onChange={onSelection} multiple immediate>
              <div className="relative border-b border-[#F1F1F2]">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-[#B4B8BF]" />
                <ComboboxInput
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="h-8 w-full bg-transparent pr-2.5 pl-8 text-[12.5px] text-[#1B1D21] outline-none placeholder:text-[#A8ADB5]"
                />
              </div>
              {picks.length > 0 && (
                <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto border-b border-[#F1F1F2] px-2 py-1.5">
                  {picks.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDraft((d) => toggleScope(d, t))}
                      className="inline-flex max-w-full items-center gap-1 rounded-lg bg-[#EEF2FE] py-0.5 pr-1 pl-2 text-[11px] font-medium text-[#2148AE] transition-colors duration-[180ms] ease-standard outline-none hover:bg-[#E4EAFB] focus-visible:ring-[3px] focus-visible:ring-[#E4EAFB]"
                    >
                      <span className="truncate">{chipOf.get(t) ?? t.slice(t.indexOf(":") + 1)}</span>
                      <XIcon className="size-3 shrink-0" aria-label="Remove" />
                    </button>
                  ))}
                </div>
              )}
              <ComboboxOptions static modal={false} className="max-h-72 overflow-y-auto p-1.5">
                {grouped.map(({ group, items }, gi) => (
                  <div key={gi}>
                    {group && (
                      <p className="px-2.5 pt-1.5 pb-0.5 text-[10.5px] font-semibold tracking-[0.1em] text-[#9AA0A9] uppercase">{group}</p>
                    )}
                    {items.map((opt) => {
                      const on = tokens.includes(opt.value);
                      const pick = isPick(opt.value);
                      return (
                        <ComboboxOption
                          key={opt.value}
                          value={opt.value}
                          className="flex w-full cursor-default items-center gap-2 rounded-[9px] px-2.5 py-1.5 text-left text-[12.5px] text-[#3A3F47] select-none data-focus:bg-[#F4F4F5] data-focus:text-[#1B1D21] data-selected:font-semibold data-selected:text-[#1B1D21]"
                        >
                          {pick && <Checkbox checked={on} tabIndex={-1} aria-hidden className="pointer-events-none" />}
                          <span className="flex-1 truncate">{opt.label}</span>
                          {!pick && on && <CheckIcon className="size-3.5 shrink-0 text-[#2A5BD7]" />}
                        </ComboboxOption>
                      );
                    })}
                  </div>
                ))}
                {!filtered.length && <p className="px-3 py-4 text-center text-[12.5px] text-[#9AA0A9]">Nothing matches.</p>}
              </ComboboxOptions>
            </Combobox>
            <div className="flex items-center justify-between gap-2 border-t border-[#F1F1F2] px-2 py-1.5">
              <Button variant="ghost" size="xs" disabled={!picks.length} onClick={() => setDraft(SCOPE_ALL)}>
                Clear
              </Button>
              <span className="flex items-center gap-2">
                {picks.length > 0 && <span className="text-[11px] text-[#6E747E] tabular-nums">{picks.length} selected</span>}
                <Button size="xs" onClick={apply}>Apply</Button>
              </span>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
