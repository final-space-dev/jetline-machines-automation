"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  Activity, AlertOctagon, BarChart3, HeartPulse, KeyRound, LayoutDashboard, LogOut, Menu, Search, Settings, Store,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shell, ShellSessionCard, type ShellNavGroup } from "@/components/ui/shell";
import { SideSheet } from "@/components/ui/side-sheet";
import { getBrand, splitBrandName } from "@/lib/brand";
import { canNav, canSeeConfig } from "@/lib/permissions";
import { useRole } from "@/lib/use-role";
import { TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";
import { NotificationBell, NotificationsProvider } from "./notification-bell";
import { OPEN_SEARCH, SearchPalette } from "./search-palette";
import { SyncPanel } from "./sync-panel";
import { ToastBridge } from "./toast-bridge";

// `cap` is the navigation capability that grants a custom user the item;
// `config` marks the Config item, shown to a custom user holding any Config section.
type Item = { href: string; label: string; icon: LucideIcon; cap?: string; config?: boolean; count?: boolean };

const NAV: { section: string; items: Item[] }[] = [
  {
    section: "Stores",
    items: [
      { href: "/stores", label: "All stores", icon: Store, cap: "all-stores" },
      { href: "/equipment/fleet", label: "Fleet health", icon: HeartPulse, cap: "fleet" },
    ],
  },
  { section: "Operations", items: [{ href: "/operations", label: "Dashboard", icon: LayoutDashboard, cap: "operations" }] },
  {
    section: "Reports",
    items: [
      { href: "/machine-reports", label: "Machine reports", icon: BarChart3, cap: "machine-reports" },
      { href: "/reports/replacements", label: "Replacement requests", icon: AlertOctagon, cap: "replacements" },
    ],
  },
  {
    section: "Config",
    items: [
      { href: "/setup", label: "Config", icon: Settings, config: true },
      { href: "/activity", label: "Activity", icon: Activity, cap: "activity", count: true },
    ],
  },
];

/** How many things happened today: the number beside Activity. */
function useTodayCount(): number {
  const [count, setCount] = React.useState(0);
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/activity?limit=1")
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { todayCount?: number } | null) => {
        if (!cancelled && json && typeof json.todayCount === "number") setCount(json.todayCount);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return count;
}

const openSearch = () => window.dispatchEvent(new Event(OPEN_SEARCH));
const leave = () => signOut({ callbackUrl: "/login" });

/**
 * The console frame: the kit Shell with Machines' menu, which is built from
 * the signed-in person's role. Store staff get their own store and Activity;
 * a custom role gets what its grant names; an admin gets everything; an
 * unresolved session gets nothing, so a restricted person never sees the
 * full menu flash. `dev` puts the DEV mark beside the name everywhere except
 * production.
 */
export function MachinesShell({ dev, children }: { dev: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const { role, store, permissions, loading } = useRole();
  const today = useTodayCount();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const brand = splitBrandName(getBrand().name);
  const product = brand.accent ? brand.lead : getBrand().name;
  const chip = [brand.accent, dev ? "DEV" : ""].filter(Boolean).join(" · ") || undefined;

  const nav: ShellNavGroup[] = React.useMemo(() => {
    const label = (item: Item) => (item.count && today > 0 ? `${item.label} ${today}` : item.label);
    if (loading) return [];
    if (role === "store_staff") {
      return [
        {
          section: "My store",
          items: [
            { href: store ? `/equipment/stores/${encodeURIComponent(store)}` : "/", label: "My store", icon: Store },
            { href: "/activity", label: today > 0 ? `Activity ${today}` : "Activity", icon: Activity },
          ],
        },
      ];
    }
    if (role !== "admin" && role !== "custom") return [];
    return NAV.map((group) => ({
      section: group.section,
      items: group.items
        .filter((item) => role === "admin" || (item.config ? canSeeConfig(role, permissions) : !!item.cap && canNav(role, permissions, item.cap)))
        .map((item) => ({ href: item.href, label: label(item), icon: item.icon })),
    })).filter((group) => group.items.length > 0);
  }, [loading, role, store, permissions, today]);

  // The item a page belongs to: the longest menu address it starts with. A store's
  // own screens (equipment, items, printers) belong to All stores.
  const hrefs = nav.flatMap((g) => g.items.map((i) => i.href));
  const current =
    hrefs.filter((href) => pathname === href || pathname.startsWith(`${href}/`)).sort((a, b) => b.length - a.length)[0] ??
    (pathname.startsWith("/equipment") ? hrefs.find((h) => h === "/stores" || h.startsWith("/equipment/stores/")) : undefined) ??
    (pathname.startsWith("/machine-mapping") ? hrefs.find((h) => h === "/setup") : undefined) ??
    null;

  const user = session.data?.user;
  const name = user?.name || user?.email || "";

  return (
    <NotificationsProvider>
      <Shell
        brand={product}
        chip={chip}
        chrome="consol"
        // Below 1024 px the sidebar gives the page its width; the bar below opens the same menu.
        className="max-lg:[&>aside]:hidden"
        nav={nav}
        activeHref={current}
        onJump={openSearch}
        user={name ? { name, email: user?.email ?? undefined } : null}
        onSignOut={leave}
        footerHint={dev ? "Dev copy · ⌘K to search" : "⌘K to search"}
        session={<ShellSessionCard name="My account" actionLabel="Open" onAction={() => router.push("/account")} />}
      >
        <ToastBridge />
        <div className="flex flex-none items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5 lg:hidden print:hidden">
          <Link href="/" className={cn(TYPE.section, "flex items-center gap-2 font-bold tracking-tight pointer-coarse:min-h-11")}>
            {getBrand().name}
            {dev && <Badge status="warning">DEV</Badge>}
          </Link>
          {/* The bell last, at the screen's edge, so its list opens fully on screen. */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" aria-label="Search" onClick={openSearch}>
              <Search />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setMenuOpen(true)}>
              <Menu />
              Menu
            </Button>
            <NotificationBell />
          </div>
        </div>
        <SideSheet
          open={menuOpen}
          onOpenChange={setMenuOpen}
          title={getBrand().name}
          subtitle={name}
          width={320}
          footer={
            <div className="flex w-full items-center justify-between gap-2">
              <Button variant="outline" size="sm" render={<Link href="/account" onClick={() => setMenuOpen(false)} />}>
                <KeyRound />
                My account
              </Button>
              <Button variant="ghost" size="sm" onClick={leave}>
                <LogOut />
                Sign out
              </Button>
            </div>
          }
        >
          <nav className="flex flex-col gap-4">
            {nav.map((group, g) => (
              <div key={group.section ?? g} className="flex flex-col gap-0.5">
                {group.section && <span className={cn(TYPE.microLabel, "px-2 pb-1")}>{group.section}</span>}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.href === current;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(TYPE.body, "flex items-center gap-3 rounded-lg px-2 py-2.5 pointer-coarse:min-h-11", active ? "bg-primary/10 font-medium text-primary" : "hover:bg-muted")}
                    >
                      <Icon className="size-4 shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>
        </SideSheet>
        {/* Pages fill this frame; on a wide screen the bell sits at the header's right edge. */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="absolute top-4 right-7 z-10 max-lg:hidden print:hidden">
            <NotificationBell size="default" />
          </div>
          {children}
        </div>
        <SearchPalette />
        <SyncPanel />
      </Shell>
    </NotificationsProvider>
  );
}
