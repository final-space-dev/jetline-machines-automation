"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, Package, Printer, Search, Store, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { getRecentItems, type RecentItem } from "@/lib/recently-viewed";
import { useRole } from "@/lib/use-role";
import { TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";

type Kind = "recent" | "store" | "item" | "printer" | "command";
interface Row {
  kind: Kind;
  primary: string;
  secondary?: string;
  href: string;
  /** A download or another origin: a full page load, not a route change. */
  external?: boolean;
}
interface StoreHit { name: string; mainGroup: string; storeGroup: string }
interface ItemHit { id: number; make_model: string | null; machine_type: string; store: string; condition: string | null }
interface PrinterHit { serial: string; model: string | null; store: string }
interface SearchResponse { stores: StoreHit[]; items: ItemHit[]; printers: PrinterHit[] }

const NONE: SearchResponse = { stores: [], items: [], printers: [] };

// Quick commands are role-aware: no point offering a store user destinations they would be bounced from.
const ADMIN_COMMANDS: Row[] = [
  { kind: "command", primary: "Go to Fleet Health", href: "/equipment/fleet" },
  { kind: "command", primary: "Replacement Requests", href: "/reports/replacements" },
  { kind: "command", primary: "Export All CSV", href: "/api/equipment/export", external: true },
  { kind: "command", primary: "Open Config", href: "/setup" },
];

function commandsForRole(role: string | null, store: string | null): Row[] {
  if (role === "store_staff") {
    return store ? [{ kind: "command", primary: "My Store", href: `/equipment/stores/${encodeURIComponent(store)}` }] : [];
  }
  return ADMIN_COMMANDS;
}

const SECTION: Record<Kind, string> = { recent: "Recent", store: "Stores", item: "Equipment", printer: "Printers", command: "Commands" };
const ICON: Record<Kind, LucideIcon> = { recent: Activity, store: Store, item: Package, printer: Printer, command: ArrowRight };

/** The event any control dispatches to open the search (the Shell's Jump, the phone bar's glass). */
export const OPEN_SEARCH = "jl:open-command-palette";

/**
 * Search and jump: recent places, then stores, equipment and printers found
 * by the server as you type, then the commands this role may run. ⌘K or
 * Ctrl+K opens it; arrows move, Enter opens, Escape closes.
 */
export function SearchPalette() {
  const router = useRouter();
  const { role, store } = useRole();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [recent, setRecent] = React.useState<RecentItem[]>([]);
  const [data, setData] = React.useState<SearchResponse>(NONE);
  const [loading, setLoading] = React.useState(false);
  const [cursor, setCursor] = React.useState(0);
  const requestId = React.useRef(0);

  // Fresh each time it opens: the field empty, the latest recents.
  const show = React.useCallback(() => {
    setQuery("");
    setData(NONE);
    setCursor(0);
    setRecent(getRecentItems().slice(0, 6));
    setOpen(true);
  }, []);
  const openRef = React.useRef(open);
  React.useEffect(() => {
    openRef.current = open;
  }, [open]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (openRef.current) setOpen(false);
        else show();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_SEARCH, show);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_SEARCH, show);
    };
  }, [show]);

  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;

  // Debounced server search; a stale answer is dropped.
  React.useEffect(() => {
    if (!trimmed) return;
    const timer = setTimeout(async () => {
      const id = ++requestId.current;
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
        const json: SearchResponse = await res.json();
        if (id !== requestId.current) return;
        setData({ stores: json.stores ?? [], items: json.items ?? [], printers: json.printers ?? [] });
      } catch {
        if (id === requestId.current) setData(NONE);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [trimmed]);

  // With the field empty there is nothing found, whatever the last answer was.
  const found = hasQuery ? data : NONE;
  const searching = hasQuery && loading;
  const rows: Row[] = React.useMemo(() => {
    const out: Row[] = [];
    if (!hasQuery) for (const r of recent) out.push({ kind: "recent", primary: r.label, secondary: r.sub, href: r.href });
    for (const s of found.stores) {
      out.push({ kind: "store", primary: s.name, secondary: `${s.mainGroup} / ${s.storeGroup}`, href: `/equipment/stores/${encodeURIComponent(s.name)}` });
    }
    for (const it of found.items) {
      out.push({
        kind: "item", primary: it.make_model || it.machine_type,
        secondary: [it.machine_type, it.store, it.condition].filter(Boolean).join(" · "), href: `/equipment/items/${it.id}`,
      });
    }
    for (const p of found.printers) {
      out.push({ kind: "printer", primary: p.serial, secondary: [p.model, p.store].filter(Boolean).join(" · "), href: `/equipment/printers/${encodeURIComponent(p.serial)}` });
    }
    const needle = trimmed.toLowerCase();
    for (const c of commandsForRole(role, store)) if (!needle || c.primary.toLowerCase().includes(needle)) out.push(c);
    return out;
  }, [hasQuery, recent, found, trimmed, role, store]);

  // The highlighted row, kept inside the list as it shrinks.
  const active = Math.min(cursor, Math.max(rows.length - 1, 0));

  const go = (row: Row | undefined) => {
    if (!row) return;
    setOpen(false);
    if (row.external || row.href.startsWith("/api/")) window.location.href = row.href;
    else router.push(row.href);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent size="form" showCloseButton={false} className="top-24 translate-y-0 gap-0 self-start p-0">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
          {searching ? <Spinner /> : <Search className="size-4 text-muted-foreground" />}
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor(rows.length ? (active + 1) % rows.length : 0);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor(rows.length ? (active - 1 + rows.length) % rows.length : 0);
              } else if (e.key === "Enter") {
                e.preventDefault();
                go(rows[active]);
              }
            }}
            placeholder="Search stores, equipment, printers…"
            aria-label="Search"
            className="border-0 shadow-none focus-visible:ring-0"
          />
          <Kbd>esc</Kbd>
        </div>
        <div className="flex max-h-96 flex-col gap-0.5 overflow-y-auto p-2">
          {rows.length === 0 && <p className={cn(TYPE.data, "px-3 py-6 text-center text-muted-foreground")}>{hasQuery && !searching ? "Nothing matches" : "Type to search"}</p>}
          {rows.map((row, i) => {
            const Icon = ICON[row.kind];
            const first = i === 0 || rows[i - 1].kind !== row.kind;
            return (
              <React.Fragment key={`${row.kind}:${row.href}:${i}`}>
                {first && <span className={cn(TYPE.microLabel, "px-3 pt-2 pb-1")}>{SECTION[row.kind]}</span>}
                <Button
                  variant="ghost"
                  className={cn("h-auto w-full justify-start gap-3 px-3 py-2 text-left text-foreground", i === active && "bg-muted")}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => go(row)}
                >
                  <Icon className="text-muted-foreground" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={cn(TYPE.data, "truncate font-medium")}>{row.primary}</span>
                    {row.secondary && <span className={cn(TYPE.micro, "truncate text-muted-foreground")}>{row.secondary}</span>}
                  </span>
                </Button>
              </React.Fragment>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
