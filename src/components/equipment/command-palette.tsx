"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Store, Package, Printer, Command, ArrowRight, Activity, Download, Plus, Settings } from "lucide-react";
import { useHotkey } from "@/lib/use-hotkey";
import { getRecentItems, type RecentItem } from "@/lib/recently-viewed";

// ── Result model ────────────────────────────────────────────────────────────
type Kind = "recent" | "store" | "item" | "printer" | "command";

interface Row {
  kind: Kind;
  primary: string;
  secondary?: string;
  href: string;
  external?: boolean; // true → window.location (e.g. CSV download)
}

interface StoreHit { name: string; mainGroup: string; storeGroup: string; }
interface ItemHit { id: number; make_model: string | null; machine_type: string; store: string; condition: string | null; }
interface PrinterHit { serial: string; model: string | null; store: string; }
interface SearchResponse { stores: StoreHit[]; items: ItemHit[]; printers: PrinterHit[]; }

const COMMANDS: Row[] = [
  { kind: "command", primary: "Go to Fleet Health", href: "/equipment/fleet" },
  { kind: "command", primary: "Export All CSV", href: "/api/equipment/export", external: true },
  { kind: "command", primary: "Add Equipment", href: "/equipment" },
  { kind: "command", primary: "Open Setup", href: "/setup" },
];

function sectionLabel(kind: Kind): string {
  switch (kind) {
    case "recent": return "RECENT";
    case "store": return "STORES";
    case "item": return "EQUIPMENT";
    case "printer": return "PRINTERS";
    case "command": return "COMMANDS";
  }
}

function KindIcon({ kind }: { kind: Kind }) {
  const c = { color: "var(--jl-ink-400)", flexShrink: 0 } as const;
  const red = { color: "var(--jl-red-500)", flexShrink: 0 } as const;
  switch (kind) {
    case "recent": return <Activity size={14} style={c} />;
    case "store": return <Store size={14} style={red} />;
    case "item": return <Package size={14} style={c} />;
    case "printer": return <Printer size={14} style={c} />;
    case "command": return <ArrowRight size={14} style={c} />;
  }
}

function CommandGlyph({ primary }: { primary: string }) {
  const c = { color: "var(--jl-ink-400)", flexShrink: 0 } as const;
  if (primary.includes("Fleet")) return <Activity size={14} style={c} />;
  if (primary.includes("Export")) return <Download size={14} style={c} />;
  if (primary.includes("Add")) return <Plus size={14} style={c} />;
  if (primary.includes("Setup")) return <Settings size={14} style={c} />;
  return <ArrowRight size={14} style={c} />;
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const [data, setData] = useState<SearchResponse>({ stores: [], items: [], printers: [] });
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reqIdRef = useRef(0);

  // ⌘K (Mac) / Ctrl+K (Win) — toggle open
  useHotkey({ key: "k", modifiers: ["cmd"], onTrigger: () => setOpen((o) => !o) });
  useHotkey({ key: "k", modifiers: ["ctrl"], onTrigger: () => setOpen((o) => !o) });
  // Header search button (or any code) can open via this event
  useEffect(() => {
    const openHandler = () => setOpen(true);
    window.addEventListener("jl:open-command-palette", openHandler);
    return () => window.removeEventListener("jl:open-command-palette", openHandler);
  }, []);

  // Reset + focus on open; load recents fresh each time
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setData({ stores: [], items: [], printers: [] });
    setCursor(0);
    setRecent(getRecentItems().slice(0, 6));
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  // Debounced search (200ms)
  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setData({ stores: [], items: [], printers: [] });
      setLoading(false);
      return;
    }
    const id = ++reqIdRef.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`);
      const json: SearchResponse = await res.json();
      if (id !== reqIdRef.current) return; // stale response
      setData({
        stores: json.stores ?? [],
        items: json.items ?? [],
        printers: json.printers ?? [],
      });
    } catch {
      if (id === reqIdRef.current) setData({ stores: [], items: [], printers: [] });
    } finally {
      if (id === reqIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 200);
    return () => clearTimeout(debounceRef.current);
  }, [query, runSearch]);

  const hasQuery = query.trim().length > 0;

  // Build flat, ordered row list (RECENT, STORES, EQUIPMENT, PRINTERS, COMMANDS)
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];

    if (!hasQuery) {
      for (const r of recent) {
        out.push({ kind: "recent", primary: r.label, secondary: r.sub, href: r.href });
      }
    }

    for (const s of data.stores) {
      out.push({
        kind: "store",
        primary: s.name,
        secondary: `${s.mainGroup} / ${s.storeGroup}`,
        href: `/stores/${encodeURIComponent(s.name)}`,
      });
    }

    for (const it of data.items) {
      const parts = [it.machine_type, it.store, it.condition].filter(Boolean) as string[];
      out.push({
        kind: "item",
        primary: it.make_model || it.machine_type,
        secondary: parts.join(" · "),
        href: `/equipment/items/${it.id}`,
      });
    }

    for (const p of data.printers) {
      const parts = [p.model, p.store].filter(Boolean) as string[];
      out.push({
        kind: "printer",
        primary: p.serial,
        secondary: parts.join(" · "),
        href: `/equipment/printers/${encodeURIComponent(p.serial)}`,
      });
    }

    const needle = query.trim().toLowerCase();
    for (const c of COMMANDS) {
      if (!needle || c.primary.toLowerCase().includes(needle)) out.push(c);
    }

    return out;
  }, [hasQuery, recent, data, query]);

  // Keep cursor in range as rows change
  useEffect(() => {
    setCursor((c) => (rows.length === 0 ? 0 : Math.min(c, rows.length - 1)));
  }, [rows.length]);

  const navigate = useCallback((row: Row | undefined) => {
    if (!row) return;
    setOpen(false);
    if (row.external || row.href.startsWith("/api/")) {
      window.location.href = row.href;
      return;
    }
    router.push(row.href);
  }, [router]);

  // Arrow / Enter / Escape on the whole palette
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => (rows.length ? (c + 1) % rows.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => (rows.length ? (c - 1 + rows.length) % rows.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      navigate(rows[cursor]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  if (!open) return null;

  // Group rows into sections while preserving flat index for the cursor
  const sections: { kind: Kind; rows: { row: Row; index: number }[] }[] = [];
  rows.forEach((row, index) => {
    const last = sections[sections.length - 1];
    if (last && last.kind === row.kind) {
      last.rows.push({ row, index });
    } else {
      sections.push({ kind: row.kind, rows: [{ row, index }] });
    }
  });

  return (
    <div
      onClick={() => setOpen(false)}
      className="jl-cmd-overlay"
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(13,17,23,0.55)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "13vh", fontFamily: "var(--jl-font)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-label="Command palette"
        className="jl-cmd-panel"
        style={{
          width: "100%", maxWidth: 600,
          background: "var(--jl-surface)",
          borderRadius: "var(--jl-r-xl)",
          boxShadow: "var(--jl-sh-xl)",
          border: "1px solid var(--jl-ink-100)",
          overflow: "hidden",
        }}
      >
        {/* Search input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1.5px solid var(--jl-ink-100)" }}>
          <Search size={16} style={{ color: "var(--jl-ink-400)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCursor(0); }}
            placeholder="Search stores, equipment, printers"
            style={{
              flex: 1, border: "none", outline: "none", fontSize: 15,
              fontFamily: "var(--jl-font)", color: "var(--jl-ink-900)", background: "transparent",
            }}
          />
          {loading && <span style={{ fontSize: 11, color: "var(--jl-ink-300)", fontWeight: 600 }}>Searching</span>}
          <span style={{ display: "flex", alignItems: "center", gap: 2, color: "var(--jl-ink-300)" }}>
            <Command size={12} /><span style={{ fontSize: 11, fontWeight: 700 }}>K</span>
          </span>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {loading && rows.length === 0 && (
            <div style={{ padding: "10px 8px" }}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px" }}>
                  <div style={{ width: 14, height: 14, borderRadius: 4, background: "var(--jl-ink-100)" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 11, width: "45%", borderRadius: 4, background: "var(--jl-ink-100)", marginBottom: 6 }} />
                    <div style={{ height: 9, width: "28%", borderRadius: 4, background: "var(--jl-ink-50)" }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && rows.length === 0 && hasQuery && (
            <div style={{ padding: "26px 16px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--jl-ink-500)", fontWeight: 600 }}>
                No results for &ldquo;{query.trim()}&rdquo;
              </p>
              <p style={{ fontSize: 12, color: "var(--jl-ink-400)", marginTop: 4 }}>Check the spelling and try again</p>
            </div>
          )}

          {!loading && rows.length === 0 && !hasQuery && (
            <div style={{ padding: "26px 16px", textAlign: "center" }}>
              <p style={{ fontSize: 13, color: "var(--jl-ink-400)", fontWeight: 600 }}>
                Search stores, equipment and printers
              </p>
            </div>
          )}

          {rows.length > 0 && sections.map((section) => (
            <div key={section.kind} style={{ padding: "6px 8px" }}>
              <p style={{
                fontSize: 10, fontWeight: 800, letterSpacing: "0.08em",
                color: "var(--jl-ink-300)", padding: "4px 10px 4px",
              }}>
                {sectionLabel(section.kind)}
              </p>
              {section.rows.map(({ row, index }) => {
                const active = index === cursor;
                return (
                  <button
                    key={`${row.kind}-${row.href}-${index}`}
                    onClick={() => navigate(row)}
                    onMouseEnter={() => setCursor(index)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, width: "100%",
                      padding: "9px 10px", borderRadius: "var(--jl-r-sm)",
                      background: active ? "var(--jl-red-tint)" : "transparent",
                      border: "none", cursor: "pointer", textAlign: "left",
                      fontFamily: "var(--jl-font)",
                      transition: "background var(--jl-t-fast)",
                    }}
                  >
                    {row.kind === "command"
                      ? <CommandGlyph primary={row.primary} />
                      : <KindIcon kind={row.kind} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: 13, fontWeight: 600,
                        color: active ? "var(--jl-red-600)" : "var(--jl-ink-800)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {row.primary}
                      </p>
                      {row.secondary && (
                        <p style={{
                          fontSize: 11, color: "var(--jl-ink-400)", marginTop: 1,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {row.secondary}
                        </p>
                      )}
                    </div>
                    {active && <ArrowRight size={13} style={{ color: "var(--jl-red-500)", flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "8px 16px", borderTop: "1px solid var(--jl-ink-100)", display: "flex", gap: 14, alignItems: "center" }}>
          {([["up down", "navigate"], ["enter", "open"], ["esc", "close"]] as const).map(([key, label]) => (
            <span key={key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--jl-ink-400)", fontWeight: 600 }}>
              <kbd style={{
                background: "var(--jl-ink-100)", color: "var(--jl-ink-600)",
                padding: "1px 6px", borderRadius: 4, fontSize: 10, fontFamily: "monospace",
              }}>{key}</kbd>
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
