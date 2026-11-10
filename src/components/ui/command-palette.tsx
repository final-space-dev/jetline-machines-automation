"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";

/**
 * Cmd+K: jump anywhere (UI/UX 2.0). The host hands the pages (shown before
 * anything is typed, in the order given) and may lazily load more records
 * (companies, customers...) the first time the palette opens; those join the
 * search once the user types. Visuals are JetlineConsol's exactly.
 */

export interface PaletteItem {
  key: string;
  label: string;
  /** The right-hand caption and the grouping word, e.g. the face or "Companies". */
  group: string;
  href: string;
  /** Two-letter kind square; defaults to the label's initials. */
  code?: string;
  /** Right-hand caption instead of the group (Consol: "Profile" for a company). */
  hint?: string;
}

/** Two-letter kind square (spec §3.11): the item's code, page initials otherwise. */
function kindCode(item: PaletteItem): string {
  if (item.code) return item.code;
  const words = item.label.split(" ").filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : item.label.slice(0, 2)).toUpperCase();
}

export function CommandPalette({
  items: pages,
  loadItems,
  placeholder = "Jump to a page or company...",
  onSelect,
  open: openProp,
  onOpenChange,
}: {
  /** Always available; the list shown before anything is typed. */
  items: PaletteItem[];
  /** Loaded once, on first open; searched together with `items`. */
  loadItems?: () => Promise<PaletteItem[]>;
  placeholder?: string;
  /** Overrides navigation (default: router push, hard navigation for a query URL). */
  onSelect?: (item: PaletteItem) => void;
  /** Controlled open state; Cmd/Ctrl+K toggles it either way. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [innerOpen, setInnerOpen] = React.useState(false);
  const controlled = openProp !== undefined;
  const open = controlled ? openProp : innerOpen;
  const [q, setQ] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [loaded, setLoaded] = React.useState<PaletteItem[] | null>(null);

  const live = React.useRef({ open, controlled, onOpenChange });
  React.useLayoutEffect(() => {
    live.current = { open, controlled, onOpenChange };
  }, [open, controlled, onOpenChange]);

  const setOpen = React.useCallback((o: boolean) => {
    if (!live.current.controlled) setInnerOpen(o);
    live.current.onOpenChange?.(o);
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!live.current.open);
        setQ("");
        setActive(0);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  React.useEffect(() => {
    if (!open || loaded || !loadItems) return;
    loadItems()
      .then(setLoaded)
      .catch(() => setLoaded([]));
  }, [open, loaded, loadItems]);

  const items = React.useMemo(() => {
    const all = [...pages, ...(loaded ?? [])];
    const needle = q.trim().toLowerCase();
    if (!needle) return pages;
    // Every word typed must be somewhere in the label or its caption, in any
    // order: "zara pricing" finds "Zara 2.0 · Pricing and quoting".
    const words = needle.split(/\s+/);
    return all.filter((i) => {
      const hay = `${i.label} ${i.hint ?? i.group}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    }).slice(0, 12);
  }, [q, loaded, pages]);

  function go(item: PaletteItem) {
    setOpen(false);
    if (onSelect) return onSelect(item);
    // query-string deep links are pushState-driven inside their page; a hard
    // route change is the reliable cross-page path
    if (item.href.includes("?")) window.location.href = item.href;
    else router.push(item.href);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        size="form"
        showCloseButton={false}
        className="top-24 translate-y-0 gap-0 self-start rounded-[18px] p-0 shadow-[0_30px_80px_rgba(28,25,23,.3)]"
      >
        <div className="flex items-center gap-3 border-b border-[#F1F1F2] px-[18px]">
          <Search className="size-4 text-[#B4B8BF]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              if (e.key === "Enter" && items[active]) go(items[active]);
            }}
            placeholder={placeholder}
            className="h-[52px] w-full bg-transparent text-[14.5px] text-[#1B1D21] outline-none placeholder:text-[#A8ADB5]"
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="max-h-[340px] overflow-y-auto p-2">
          {items.length === 0 && <p className="px-4 py-6 text-center text-xs text-[#9AA0A9]">Nothing matches.</p>}
          {items.map((item, i) => (
            <button
              key={item.key}
              type="button"
              onClick={() => go(item)}
              onMouseEnter={() => setActive(i)}
              className={`flex w-full items-center gap-3 rounded-[11px] px-[13px] py-[9px] pointer-coarse:min-h-11 text-left transition-colors duration-[180ms] ease-standard ${
                i === active ? "bg-[#F4F4F5]" : ""
              }`}
            >
              <span
                aria-hidden
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-[7px] bg-[#F1F2F3] text-[11px] font-semibold text-[#696F79]"
              >
                {kindCode(item)}
              </span>
              <span className="flex-1 truncate text-[12.5px] text-[#1B1D21]">{item.label}</span>
              <span className="text-[11.5px] text-[#A8ADB5]">{item.hint ?? item.group}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
