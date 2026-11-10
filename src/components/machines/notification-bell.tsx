"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell, CalendarClock, Check, FileWarning, Recycle, Wrench, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { STATUS, TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";
import { formatDate } from "@/lib/utils";

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
  const mins = Math.floor((Date.now() - then) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}

const KIND: Record<string, [LucideIcon, string]> = {
  service_overdue: [Wrench, STATUS.danger],
  service_due_soon: [Wrench, STATUS.warning],
  contract_expiring: [CalendarClock, STATUS.warning],
  contract_expired: [FileWarning, STATUS.danger],
  equipment_poor: [AlertTriangle, STATUS.danger],
  replace_flagged: [Recycle, STATUS.warning],
  replacement_requested: [Recycle, STATUS.warning],
};

function hrefOf(n: DbNotification): string | null {
  if (n.itemId) return `/equipment/items/${n.itemId}`;
  if (n.serial) return `/equipment/printers/${encodeURIComponent(n.serial)}`;
  if (n.store) return `/equipment/stores/${encodeURIComponent(n.store)}`;
  return null;
}

interface Inbox {
  items: DbNotification[];
  unread: number;
  busy: boolean;
  markRead: (id: number) => void;
  markAllRead: () => void;
}

const InboxContext = React.createContext<Inbox | null>(null);

/** One poll for the whole console: every bell on screen reads the same inbox. */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<DbNotification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const data: { notifications: DbNotification[]; unread: number } = await res.json();
      setItems(data.notifications ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      // A network hiccup: keep what was shown; the next poll retries.
    }
  }, []);

  React.useEffect(() => {
    // The first read is scheduled like every later one, so the effect only subscribes.
    const first = setTimeout(load, 0);
    const t = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  const markRead = React.useCallback(
    async (id: number) => {
      setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setUnread((u) => Math.max(0, u - 1));
      try {
        await fetch(`/api/notifications/${id}`, { method: "PATCH" });
      } catch {
        load();
      }
    },
    [load],
  );

  const markAllRead = React.useCallback(async () => {
    setBusy(true);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await fetch("/api/notifications/read-all", { method: "PATCH" });
    } catch {
      load();
    } finally {
      setBusy(false);
    }
  }, [load]);

  const value = React.useMemo(() => ({ items, unread, busy, markRead, markAllRead }), [items, unread, busy, markRead, markAllRead]);
  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

/** The bell: unread count on the button, the latest notices in a list; opening one marks it read and goes to it. */
export function NotificationBell({ size = "sm" }: { size?: "sm" | "default" }) {
  const router = useRouter();
  const inbox = React.useContext(InboxContext);
  const [open, setOpen] = React.useState(false);
  if (!inbox) return null;
  const { items, unread, busy, markRead, markAllRead } = inbox;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" size={size} aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} />}>
        <Bell />
        {unread > 0 && <Badge status="danger">{unread > 99 ? "99+" : unread}</Badge>}
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-1 p-2">
        <div className="flex items-center justify-between gap-2 px-2 py-1">
          <span className={TYPE.section}>Notifications</span>
          {unread > 0 && (
            <Button variant="ghost" size="xs" disabled={busy} onClick={markAllRead}>
              <Check />
              Mark all read
            </Button>
          )}
        </div>
        <div className="flex max-h-96 flex-col gap-0.5 overflow-y-auto">
          {items.length === 0 && <p className={cn(TYPE.data, "px-2 py-6 text-center text-muted-foreground")}>Nothing new</p>}
          {items.map((n) => {
            const [Icon, chip] = KIND[n.type] ?? [Bell, STATUS.neutral];
            const href = hrefOf(n);
            return (
              <Button
                key={n.id}
                variant="ghost"
                className={cn("h-auto w-full items-start justify-start gap-3 px-2 py-2 text-left whitespace-normal", !n.read && "bg-muted")}
                onClick={() => {
                  if (!n.read) markRead(n.id);
                  if (href) {
                    setOpen(false);
                    router.push(href);
                  }
                }}
              >
                <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", chip)}>
                  <Icon />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cn(TYPE.data, "text-foreground", !n.read && "font-semibold")}>{n.message}</span>
                  <span className={cn(TYPE.micro, "text-muted-foreground")}>
                    {[n.store, relativeTime(n.createdAt)].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
