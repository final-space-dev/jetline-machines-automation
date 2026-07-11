"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Check,
  X,
  AlertTriangle,
  CalendarClock,
  FileWarning,
  Wrench,
  Recycle,
} from "lucide-react";

interface DbNotification {
  id: number;
  type: string;
  message: string;
  store: string | null;
  itemId: number | null;
  serial: string | null;
  read: boolean;
  createdAt: string;
}

const POLL_MS = 60_000;

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function TypeIcon({ type }: { type: string }) {
  const size = 16;
  switch (type) {
    case "service_overdue":
      return <Wrench size={size} style={{ color: "var(--jl-red-500, #e6121f)" }} />;
    case "service_due_soon":
      return <Wrench size={size} style={{ color: "var(--jl-amber-500, #d97706)" }} />;
    case "contract_expiring":
      return <CalendarClock size={size} style={{ color: "var(--jl-amber-500, #d97706)" }} />;
    case "contract_expired":
      return <FileWarning size={size} style={{ color: "var(--jl-red-500, #e6121f)" }} />;
    case "equipment_poor":
      return <AlertTriangle size={size} style={{ color: "var(--jl-red-500, #e6121f)" }} />;
    case "replace_flagged":
    case "replacement_requested":
      return <Recycle size={size} style={{ color: "var(--jl-amber-500, #d97706)" }} />;
    default:
      return <Bell size={size} style={{ color: "var(--jl-ink-400, #94a3b8)" }} />;
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DbNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data: { notifications: DbNotification[]; unread: number } = await res.json();
      setItems(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      // Network hiccup — keep previous state, next poll retries.
    }
  }, []);

  // Poll every 60s and on mount.
  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function markRead(id: number) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await fetch(`/api/notifications/${id}`, { method: "PATCH" });
    } catch {
      load();
    }
  }

  async function markAllRead() {
    setLoading(true);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await fetch("/api/notifications/read-all", { method: "PATCH" });
    } catch {
      load();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: 36,
          width: 36,
          borderRadius: "var(--jl-r-sm, 8px)",
          border: "1px solid var(--jl-ink-100, #e2e8f0)",
          background: "var(--jl-surface, #fff)",
          color: "var(--jl-ink-600, #475569)",
          cursor: "pointer",
          transition: "border-color 0.15s, box-shadow 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--jl-red-500, #e6121f)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.borderColor = "var(--jl-ink-100, #e2e8f0)";
        }}
      >
        <Bell size={17} />
        {unread > 0 && (
          <span
            style={{
              position: "absolute",
              top: -5,
              right: -5,
              minWidth: 17,
              height: 17,
              padding: "0 4px",
              borderRadius: 999,
              background: "var(--jl-red-500, #e6121f)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              lineHeight: "17px",
              textAlign: "center",
              boxShadow: "0 0 0 2px var(--jl-surface, #fff)",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: 46,
            right: 0,
            width: 360,
            maxHeight: 460,
            display: "flex",
            flexDirection: "column",
            background: "var(--jl-surface, #fff)",
            border: "1px solid var(--jl-ink-100, #e2e8f0)",
            borderRadius: "var(--jl-r-lg, 14px)",
            boxShadow: "var(--jl-sh-md, 0 8px 30px rgba(0,0,0,0.14))",
            zIndex: 50,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 14px",
              borderBottom: "1px solid var(--jl-ink-50, #f1f5f9)",
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 800, color: "var(--jl-ink-900, #0f172a)" }}>
              Notifications
            </span>
            <button
              type="button"
              onClick={markAllRead}
              disabled={loading || unread === 0}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 9px",
                borderRadius: "var(--jl-r-sm, 8px)",
                border: "1px solid var(--jl-ink-100, #e2e8f0)",
                background: "var(--jl-surface, #fff)",
                color: unread === 0 ? "var(--jl-ink-300, #cbd5e1)" : "var(--jl-ink-600, #475569)",
                fontSize: 12,
                fontWeight: 700,
                cursor: unread === 0 ? "default" : "pointer",
              }}
            >
              <Check size={13} />
              Mark all read
            </button>
          </div>

          <div style={{ overflowY: "auto" }}>
            {items.length === 0 ? (
              <div
                style={{
                  padding: "34px 14px",
                  textAlign: "center",
                  fontSize: 13,
                  color: "var(--jl-ink-400, #94a3b8)",
                }}
              >
                No notifications
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "11px 14px",
                    borderBottom: "1px solid var(--jl-ink-50, #f1f5f9)",
                    background: n.read ? "var(--jl-surface, #fff)" : "var(--jl-red-50, #fef2f2)",
                  }}
                >
                  <span style={{ marginTop: 1, flexShrink: 0 }}>
                    <TypeIcon type={n.type} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: n.read ? 500 : 700,
                        color: "var(--jl-ink-900, #0f172a)",
                        lineHeight: 1.4,
                      }}
                    >
                      {n.message}
                    </div>
                    <div
                      style={{
                        marginTop: 3,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 11,
                        color: "var(--jl-ink-400, #94a3b8)",
                      }}
                    >
                      {n.store && (
                        <span style={{ fontWeight: 700, color: "var(--jl-ink-500, #64748b)" }}>
                          {n.store}
                        </span>
                      )}
                      <span>{relativeTime(n.createdAt)}</span>
                    </div>
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      aria-label="Mark read"
                      onClick={() => markRead(n.id)}
                      style={{
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: 22,
                        width: 22,
                        borderRadius: "var(--jl-r-sm, 8px)",
                        border: "none",
                        background: "transparent",
                        color: "var(--jl-ink-400, #94a3b8)",
                        cursor: "pointer",
                      }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
