"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Printer,
  ArrowUpRight,
  Settings,
  RefreshCw,
  ChevronLeft,
  Menu,
  FileText,
  ClipboardCheck,
  BarChart3,
  FileBarChart,
  GitCompare,
  ScanLine,
  LayoutDashboard,
} from "lucide-react";
import { getFeatureToggles, type FeatureToggles } from "@/lib/feature-toggles";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

type NavItem = { name: string; href: string; icon: typeof Printer; toggleKey?: keyof FeatureToggles };

const mainNavigation: NavItem[] = [
  { name: "Xerox Reporting", href: "/xerox-reporting", icon: ScanLine },
];

const otherToolsNavigation: NavItem[] = [
  { name: "Machines",        href: "/machines",        icon: Printer,        toggleKey: "machines" },
  { name: "Machines Audit",  href: "/machines-audit",  icon: ClipboardCheck, toggleKey: "machinesAudit" },
  { name: "Performance",     href: "/performance",     icon: BarChart3,      toggleKey: "performance" },
  { name: "Reports",         href: "/reports",         icon: FileBarChart,   toggleKey: "reports" },
  { name: "Existence Recon", href: "/existence-recon", icon: GitCompare,     toggleKey: "existenceRecon" },
  { name: "Dashboard",       href: "/dashboard",       icon: LayoutDashboard, toggleKey: "dashboard" },
  { name: "Contracts",       href: "/contracts",       icon: FileText,       toggleKey: "contracts" },
  { name: "Lift Planner",    href: "/lift",            icon: ArrowUpRight,   toggleKey: "liftPlanner" },
];

const secondaryNavigation: NavItem[] = [
  { name: "Sync Status", href: "/sync",     icon: RefreshCw, toggleKey: "syncStatus" },
  { name: "Settings",    href: "/settings", icon: Settings },
];

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [toggles, setToggles] = useState<FeatureToggles>(getFeatureToggles);

  useEffect(() => {
    const handler = () => setToggles(getFeatureToggles());
    window.addEventListener("storage", handler);
    const interval = setInterval(() => setToggles(getFeatureToggles()), 1000);
    return () => {
      window.removeEventListener("storage", handler);
      clearInterval(interval);
    };
  }, []);

  const visibleOtherTools = otherToolsNavigation.filter(
    (item) => !item.toggleKey || toggles[item.toggleKey]
  );

  const visibleSecondary = secondaryNavigation.filter(
    (item) => !item.toggleKey || toggles[item.toggleKey]
  );

  function NavButton({ item }: { item: NavItem }) {
    const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
    return (
      <Link key={item.name} href={item.href}>
        <button
          className={cn(
            "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
            isActive
              ? "bg-blue-600 text-white"
              : "text-gray-600 hover:bg-blue-50 hover:text-blue-700",
            isCollapsed && "justify-center px-2"
          )}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!isCollapsed && item.name}
        </button>
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col border-r bg-card transition-all duration-300",
        isCollapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Printer className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-semibold">Jetline Fleet</h1>
              <p className="text-xs text-muted-foreground">Operations</p>
            </div>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={onToggle}>
          {isCollapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {mainNavigation.map((item) => <NavButton key={item.href} item={item} />)}
        </nav>

        {visibleOtherTools.length > 0 && (
          <>
            <Separator className="my-4" />
            {!isCollapsed && (
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1">
                Other Tools
              </p>
            )}
            <nav className="space-y-1">
              {visibleOtherTools.map((item) => <NavButton key={item.href} item={item} />)}
            </nav>
          </>
        )}

        <Separator className="my-4" />

        <nav className="space-y-1">
          {visibleSecondary.map((item) => <NavButton key={item.href} item={item} />)}
        </nav>
      </ScrollArea>

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            v1.0.0
          </p>
        </div>
      )}
    </div>
  );
}
