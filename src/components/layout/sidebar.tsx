"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getBrand, splitBrandName } from "@/lib/brand";
import {
  ChevronLeft,
  Menu,
  X,
  GitMerge,
  LayoutDashboard,
  BarChart3,
  Store,
  HeartPulse,
  Activity,
  Settings,
} from "lucide-react";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

type NavItem = { name: string; href: string; icon: typeof Store; badge?: boolean };
type Section = {
  key: string;
  title: string;
  items: NavItem[];
};

const SECTIONS: Section[] = [
  {
    key: "stores",
    title: "Stores",
    items: [
      { name: "All Stores", href: "/stores", icon: Store },
      { name: "Fleet Health", href: "/equipment/fleet", icon: HeartPulse },
    ],
  },
  {
    key: "operations",
    title: "Operations",
    items: [
      { name: "Dashboard", href: "/operations", icon: LayoutDashboard },
      { name: "Machine Reports", href: "/machine-reports", icon: BarChart3 },
    ],
  },
  {
    key: "config",
    title: "Config",
    items: [
      { name: "Config", href: "/setup", icon: Settings },
      // Activity sits below Config per the menu ordering. It keeps the today-count badge.
      { name: "Activity", href: "/activity", icon: Activity, badge: true },
    ],
  },
];

/* Brand block — rounded red-gradient mark + two-tone wordmark, matching the
   reference .wa-brand / .wa-brand__mark. If a logo URL is configured it renders
   the logo wordmark instead. `mark` shows just the square mark (collapsed rail). */
function BrandBlock({ mark }: { mark?: boolean }) {
  const brand = getBrand();
  const { lead, accent } = splitBrandName(brand.name);
  const markChar = (accent || brand.name).charAt(0).toUpperCase();

  const markEl = (
    <div
      style={{
        width: 40,
        height: 40,
        flex: "none",
        borderRadius: "var(--r-md)",
        background:
          "linear-gradient(160deg, var(--red-400), var(--red-500) 55%, var(--red-600))",
        boxShadow: "var(--sh-red)",
        display: "grid",
        placeItems: "center",
        color: "#fff",
        fontWeight: 800,
        fontSize: 18,
      }}
    >
      {markChar}
    </div>
  );

  // Collapsed rail shows just the square F mark. The expanded brand shows the
  // wordmark WITHOUT the mark (the mark now lives only in the rail + the favicon).
  if (mark) return markEl;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
      {brand.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={brand.logoUrl} alt={brand.name} style={{ height: 24, width: "auto", display: "block" }} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
          <span
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "var(--ink-900)",
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            {accent ? lead : brand.name}
          </span>
          {accent && (
            <span
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#fff",
                background: "var(--red-500)",
                borderRadius: 8,
                padding: "2px 8px 3px 6px",
                marginLeft: 5,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              {accent}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
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

function NavBadge({ count, small }: { count: number; small?: boolean }) {
  const size = small ? 18 : 20;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minWidth: size,
        height: size,
        padding: small ? "0 5px" : "0 6px",
        borderRadius: "var(--r-pill)",
        background: "var(--red-500)",
        color: "#fff",
        fontSize: small ? 10 : 11,
        fontWeight: 800,
        lineHeight: 1,
      }}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const todayCount = useTodayCount();

  // Show the full nav. Actual access to /setup/* is enforced server-side by the
  // middleware, so we do NOT hide sections based on a client session check —
  // that made the whole Setup section vanish whenever the session was slow to
  // resolve, which read as a broken/incomplete menu.
  const visibleSections = SECTIONS;

  function NavRow({ item }: { item: NavItem }) {
    const active = isItemActive(pathname, item.href);
    const showBadge = item.badge && todayCount > 0;
    return (
      <Link
        href={item.href}
        title={isCollapsed ? item.name : undefined}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: isCollapsed ? "0" : "0 12px",
          justifyContent: isCollapsed ? "center" : "flex-start",
          height: 40,
          borderRadius: "var(--r-sm)",
          fontSize: 14,
          fontWeight: 600,
          fontFamily: "var(--font)",
          color: active ? "var(--red-500)" : "var(--ink-600)",
          background: active ? "var(--red-tint)" : "transparent",
          transition: "background var(--t-fast), color var(--t-fast)",
        }}
        onMouseEnter={(e) => {
          if (!active) e.currentTarget.style.background = "var(--ink-50)";
        }}
        onMouseLeave={(e) => {
          if (!active) e.currentTarget.style.background = "transparent";
        }}
      >
        <item.icon className="h-[18px] w-[18px] shrink-0" />
        {!isCollapsed && <span style={{ flex: 1 }}>{item.name}</span>}
        {!isCollapsed && showBadge && <NavBadge count={todayCount} small />}
      </Link>
    );
  }

  return (
    <aside
      className="jl-sidebar"
      style={{
        width: isCollapsed ? 72 : 264,
        flex: "none",
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        boxShadow: "var(--sh-md)",
        zIndex: 2,
        fontFamily: "var(--font)",
        transition: "width var(--t-base) var(--ease)",
      }}
    >
      {/* Brand */}
      <div
        style={{
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "flex-start",
          padding: isCollapsed ? "0" : "0 20px",
        }}
      >
        <BrandBlock mark={isCollapsed} />
      </div>

      {/* Navigation */}
      <nav
        style={{
          flex: 1,
          overflowY: "auto",
          overscrollBehavior: "contain",
          padding: isCollapsed ? "8px 12px" : "8px 12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        {visibleSections.map((section) => (
          <div key={section.key}>
            {!isCollapsed && (
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--ink-400)",
                  padding: "0 12px 8px",
                  margin: 0,
                }}
              >
                {section.title}
              </p>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {section.items.map((item) => (
                <NavRow key={item.href} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div
        style={{
          padding: 12,
          display: "flex",
          justifyContent: isCollapsed ? "center" : "flex-end",
        }}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="jl-btn jl-btn--ghost jl-btn--sm jl-btn--icon"
        >
          {isCollapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}

/* ── Mobile navigation drawer ─────────────────────────────────────────────────
   Full nav list shown from the hamburger on mobile. Reuses SECTIONS + role
   gating + the Activity badge. Rendered by the Header; controlled via `open`. */
export function MobileNavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const todayCount = useTodayCount();

  // Close automatically whenever the route changes.
  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open) return null;

  const visibleSections = SECTIONS;

  return (
    <div className="jl-mobile-overlay" onClick={onClose} role="dialog" aria-label="Navigation menu">
      <div className="jl-mobile-drawer" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            height: 72,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px",
          }}
        >
          <BrandBlock />
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
              color: "var(--ink-500)",
              cursor: "pointer",
            }}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div style={{ flex: 1, padding: "8px 12px 16px", overflowY: "auto" }}>
          {visibleSections.map((section) => (
            <div key={section.key} style={{ marginBottom: 20 }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--ink-400)",
                  padding: "0 12px 8px",
                  margin: 0,
                }}
              >
                {section.title}
              </p>
              <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {section.items.map((item) => {
                  const active = isItemActive(pathname, item.href);
                  const showBadge = item.badge && todayCount > 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        minHeight: 48,
                        padding: "0 12px",
                        borderRadius: "var(--r-sm)",
                        fontSize: 15,
                        fontWeight: 700,
                        fontFamily: "var(--font)",
                        color: active ? "var(--red-500)" : "var(--ink-700)",
                        background: active ? "var(--red-tint)" : "transparent",
                      }}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span style={{ flex: 1 }}>{item.name}</span>
                      {showBadge && <NavBadge count={todayCount} />}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
