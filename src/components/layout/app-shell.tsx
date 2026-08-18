"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Store, HeartPulse, LayoutDashboard, Search, Settings } from "lucide-react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { SyncProgressPanel } from "@/components/sync/sync-progress-panel";
import { CommandPalette } from "@/components/equipment/command-palette";
import { useRole } from "@/lib/use-role";
import { canNav, canSeeConfig } from "@/lib/permissions";

interface AppShellProps {
  children: React.ReactNode;
}

type BottomNavItem = {
  key: string;
  label: string;
  icon: typeof Store;
  href?: string;
  action?: () => void;
};

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

function openCommandPalette() {
  // Same path the header search trigger uses — self-registered in CommandPalette.
  window.dispatchEvent(new Event("jl:open-command-palette"));
}

function BottomNav() {
  const pathname = usePathname();
  const { role, permissions, isAdmin } = useRole();
  const isCustom = role === "custom";
  // For custom users, only show destinations they hold; admins/store staff keep
  // their existing bottom-nav behaviour.
  const allow = (cap: string) => !isCustom || canNav(role, permissions, cap);

  const items: BottomNavItem[] = [];
  if (allow("all-stores")) items.push({ key: "stores", label: "Stores", icon: Store, href: "/stores" });
  if (allow("fleet")) items.push({ key: "fleet", label: "Fleet", icon: HeartPulse, href: "/equipment/fleet" });
  if (allow("operations")) items.push({ key: "ops", label: "Operations", icon: LayoutDashboard, href: "/operations" });
  items.push({ key: "search", label: "Search", icon: Search, action: openCommandPalette });
  // Setup for admins, or a custom user holding any Config section.
  if (isAdmin || (isCustom && canSeeConfig(role, permissions))) {
    items.push({ key: "setup", label: "Setup", icon: Settings, href: "/setup" });
  }

  return (
    <nav className="jl-bottom-nav" aria-label="Primary">
      {items.map((item) => {
        const active = item.href ? isActive(pathname, item.href) : false;
        const Icon = item.icon;
        if (item.href) {
          return (
            <Link
              key={item.key}
              href={item.href}
              className="jl-bottom-nav-btn"
              data-active={active ? "true" : "false"}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        }
        return (
          <button
            key={item.key}
            type="button"
            onClick={item.action}
            className="jl-bottom-nav-btn"
            data-active="false"
            aria-label={item.label}
          >
            <Icon className="h-5 w-5" />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // NOTE: no <SessionProvider> here — it lives in (dashboard)/layout.tsx and
  // PERSISTS across navigations. Mounting a second one here made it re-init to
  // "loading" on every page change, which flashed the full menu before the
  // role resolved (very visible for restricted "custom" users). One persistent
  // provider = session stays resolved across navigation = no flicker.
  return (
    <div className="flex h-screen" style={{ background: "var(--canvas)" }}>
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main
          className="jl-main-scroll flex-1 overflow-auto p-4 md:p-6"
          style={{ background: "var(--canvas)" }}
        >
          {children}
        </main>
      </div>
      <SyncProgressPanel />
      <CommandPalette />
      <BottomNav />
    </div>
  );
}
