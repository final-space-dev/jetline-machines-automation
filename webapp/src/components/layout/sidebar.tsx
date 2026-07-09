"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRole } from "@/lib/use-role";
import { cn } from "@/lib/utils";
import { getBrand, splitBrandName } from "@/lib/brand";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ChevronLeft,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  GitMerge,
  LayoutDashboard,
  BarChart3,
  Store,
  HeartPulse,
  Boxes,
  Layers,
  Gauge,
  BookOpen,
  PlugZap,
  Activity,
  Users,
} from "lucide-react";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

type NavItem = { name: string; href: string; icon: typeof Store; badge?: boolean };
type Section = {
  key: string;
  title: string;
  defaultOpen: boolean;
  items: NavItem[];
};

const SECTIONS: Section[] = [
  {
    key: "stores",
    title: "Stores",
    defaultOpen: true,
    items: [
      { name: "All Stores",   href: "/stores",            icon: Store },
      { name: "Fleet Health", href: "/equipment/fleet",   icon: HeartPulse },
      { name: "Models",       href: "/equipment/models",  icon: BookOpen },
    ],
  },
  {
    key: "operations",
    title: "Operations",
    defaultOpen: false,
    items: [
      { name: "Dashboard",       href: "/operations",      icon: LayoutDashboard },
      { name: "Activity",        href: "/activity",        icon: Activity, badge: true },
      { name: "Machine Reports", href: "/machine-reports", icon: BarChart3 },
      { name: "Machine Mapping", href: "/machine-mapping", icon: GitMerge },
    ],
  },
  {
    key: "setup",
    title: "Setup",
    defaultOpen: false,
    items: [
      { name: "Equipment Types", href: "/setup/equipment-types", icon: Boxes },
      { name: "Conditions",      href: "/setup/conditions",      icon: Gauge },
      { name: "Models",          href: "/setup/models",          icon: BookOpen },
      { name: "Store Groups",    href: "/setup/store-groups",    icon: Layers },
      { name: "Connections",     href: "/setup/connections",     icon: PlugZap },
      { name: "Users",           href: "/setup/users",           icon: Users },
    ],
  },
];

const STORAGE_PREFIX = "jl-nav-section:";

// Phase 20 — white-label wordmark. Reads BRAND_NAME / BRAND_COLOR / logo from
// brand config (NEXT_PUBLIC_* env). Defaults to the JetlineFleet two-tone
// wordmark with the JL red accent pill. If a logo URL is configured it renders
// the logo instead of the wordmark.
function BrandWordmark({ fontSize }: { fontSize: number }) {
  const brand = getBrand();

  if (brand.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={brand.logoUrl}
        alt={brand.name}
        style={{ height: fontSize + 6, width: "auto", display: "block" }}
      />
    );
  }

  const { lead, accent } = splitBrandName(brand.name);
  return (
    <div style={{ display: "flex", alignItems: "center", fontFamily: "var(--jl-font)" }}>
      <span
        style={{
          fontSize,
          fontWeight: 900,
          color: "var(--jl-ink-900)",
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        {accent ? lead : brand.name}
      </span>
      {accent && (
        <span
          style={{
            fontSize,
            fontWeight: 900,
            color: "#fff",
            letterSpacing: "-0.02em",
            lineHeight: 1,
            background: brand.color,
            borderRadius: fontSize < 22 ? 9 : 10,
            padding: fontSize < 22 ? "2px 9px 3px 7px" : "2px 10px 3px 8px",
            marginLeft: 5,
          }}
        >
          {accent}
        </span>
      )}
    </div>
  );
}

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

function sectionHasActive(pathname: string, section: Section): boolean {
  return section.items.some((item) => isItemActive(pathname, item.href));
}

// Today's change count for the Activity nav badge, shared by the desktop
// sidebar and the mobile drawer. 0 while loading hides the badge.
function useTodayCount(): number {
  const pathname = usePathname();
  const [todayCount, setTodayCount] = useState<number>(0);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/activity?limit=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { todayCount?: number } | null) => {
        if (!cancelled && json && typeof json.todayCount === "number") {
          setTodayCount(json.todayCount);
        }
      })
      .catch(() => {
        /* badge is non-critical — silently ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);
  return todayCount;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const { isAdmin } = useRole();

  const todayCount = useTodayCount();

  // Setup section is admin-only. While the session loads, isAdmin is false so
  // Setup stays hidden (least-privileged default - no flash to store staff).
  const visibleSections = SECTIONS.filter((s) => s.key !== "setup" || isAdmin);

  // Open state per section key. Seed with defaults for SSR-safe first paint.
  const [openState, setOpenState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(SECTIONS.map((s) => [s.key, s.defaultOpen]))
  );

  // Hydrate persisted collapse state from localStorage after mount.
  useEffect(() => {
    setOpenState((prev) => {
      const next = { ...prev };
      for (const section of SECTIONS) {
        const raw = window.localStorage.getItem(STORAGE_PREFIX + section.key);
        if (raw === "1") next[section.key] = true;
        else if (raw === "0") next[section.key] = false;
      }
      return next;
    });
  }, []);

  // Auto-expand the section that owns the current route.
  useEffect(() => {
    const active = SECTIONS.find((s) => sectionHasActive(pathname, s));
    if (!active) return;
    setOpenState((prev) => (prev[active.key] ? prev : { ...prev, [active.key]: true }));
  }, [pathname]);

  function toggleSection(key: string) {
    setOpenState((prev) => {
      const nextOpen = !prev[key];
      window.localStorage.setItem(STORAGE_PREFIX + key, nextOpen ? "1" : "0");
      return { ...prev, [key]: nextOpen };
    });
  }

  function NavButton({ item }: { item: NavItem }) {
    const active = isItemActive(pathname, item.href);
    const showBadge = item.badge && todayCount > 0;
    return (
      <Link href={item.href}>
        <button
          style={
            active
              ? { background: "var(--jl-red-tint)", color: "var(--jl-red-500)" }
              : { color: "var(--jl-ink-600)" }
          }
          onMouseEnter={(e) => {
            if (!active) e.currentTarget.style.background = "var(--jl-red-tint)";
          }}
          onMouseLeave={(e) => {
            if (!active) e.currentTarget.style.background = "transparent";
          }}
          className={cn(
            "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-150",
            isCollapsed ? "justify-center px-2" : "pl-4"
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!isCollapsed && <span className="flex-1 text-left">{item.name}</span>}
          {showBadge && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 18,
                height: 18,
                padding: "0 5px",
                borderRadius: "var(--jl-r-pill)",
                background: "var(--jl-red-500)",
                color: "#fff",
                fontSize: 10,
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              {todayCount > 99 ? "99+" : todayCount}
            </span>
          )}
        </button>
      </Link>
    );
  }

  function NavSection({ section }: { section: Section }) {
    const open = openState[section.key];

    // Collapsed rail: no section headers, just the item icons stacked.
    if (isCollapsed) {
      return (
        <nav className="space-y-0.5">
          {section.items.map((item) => (
            <NavButton key={item.href} item={item} />
          ))}
        </nav>
      );
    }

    return (
      <div>
        <button
          type="button"
          onClick={() => toggleSection(section.key)}
          aria-expanded={open}
          className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-left text-[13px] font-extrabold uppercase tracking-wide transition-colors duration-150"
          style={{ color: "var(--jl-ink-500)", letterSpacing: "0.06em" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--jl-red-tint)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
          {section.title}
        </button>
        {open && (
          <nav className="mt-0.5 space-y-0.5">
            {section.items.map((item) => (
              <NavButton key={item.href} item={item} />
            ))}
          </nav>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "jl-sidebar flex flex-col border-r bg-white transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
      style={{ fontFamily: "var(--jl-font)", boxShadow: "var(--jl-sh-sm)" }}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {!isCollapsed && <BrandWordmark fontSize={22} />}
        <Button variant="ghost" size="icon" onClick={onToggle} className="shrink-0">
          {isCollapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <div className="space-y-3">
          {visibleSections.map((section) => (
            <NavSection key={section.key} section={section} />
          ))}
        </div>
      </ScrollArea>

      {/* Footer */}
      {!isCollapsed && (
        <div className="border-t p-4">
          <p className="text-center text-[10px] font-semibold" style={{ color: "var(--jl-ink-300)" }}>
            v1.0.0
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Mobile navigation drawer ─────────────────────────────────────────────────
   Full nav list shown from the hamburger on mobile. Reuses SECTIONS + role
   gating + the Activity badge. Rendered by the Header; controlled via `open`. */
export function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const { isAdmin } = useRole();
  const todayCount = useTodayCount();

  // Close automatically whenever the route changes.
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open) return null;

  const visibleSections = SECTIONS.filter((s) => s.key !== "setup" || isAdmin);

  return (
    <div className="jl-mobile-overlay" onClick={onClose} role="dialog" aria-label="Navigation menu">
      <div className="jl-mobile-drawer" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
            borderBottom: "1.5px solid var(--jl-ink-100)",
          }}
        >
          <BrandWordmark fontSize={20} />
          <button
            onClick={onClose}
            aria-label="Close menu"
            style={{
              width: 44,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              background: "transparent",
              color: "var(--jl-ink-500)",
              cursor: "pointer",
            }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div style={{ flex: 1, padding: "14px 12px", overflowY: "auto" }}>
          {visibleSections.map((section) => (
            <div key={section.key} style={{ marginBottom: 18 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--jl-ink-400)",
                  padding: "0 8px 6px",
                }}
              >
                {section.title}
              </p>
              <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {section.items.map((item) => {
                  const active = isItemActive(pathname, item.href);
                  const showBadge = item.badge && todayCount > 0;
                  return (
                    <Link key={item.href} href={item.href} onClick={onClose}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          minHeight: 48,
                          padding: "0 12px",
                          borderRadius: "var(--jl-r-sm)",
                          fontSize: 15,
                          fontWeight: 700,
                          fontFamily: "var(--jl-font)",
                          color: active ? "var(--jl-red-500)" : "var(--jl-ink-700)",
                          background: active ? "var(--jl-red-tint)" : "transparent",
                        }}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span style={{ flex: 1 }}>{item.name}</span>
                        {showBadge && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              minWidth: 20,
                              height: 20,
                              padding: "0 6px",
                              borderRadius: "var(--jl-r-pill)",
                              background: "var(--jl-red-500)",
                              color: "#fff",
                              fontSize: 11,
                              fontWeight: 800,
                            }}
                          >
                            {todayCount > 99 ? "99+" : todayCount}
                          </span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        <div style={{ borderTop: "1px solid var(--jl-ink-100)", padding: 16 }}>
          <p style={{ textAlign: "center", fontSize: 10, fontWeight: 600, color: "var(--jl-ink-300)" }}>
            v1.0.0
          </p>
        </div>
      </div>
    </div>
  );
}
