"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Printer,
  Building2,
  ArrowUpRight,
  Settings,
  RefreshCw,
  ChevronLeft,
  Menu,
  BarChart3,
  FileText,
} from "lucide-react";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Stores", href: "/stores", icon: Building2 },
  { name: "Machines", href: "/machines", icon: Printer },
  { name: "Models", href: "/models", icon: BarChart3 },
  { name: "Contracts", href: "/contracts", icon: FileText },
  { name: "Lift Planner", href: "/lift", icon: ArrowUpRight },
];

const secondaryNavigation = [
  { name: "Sync Status", href: "/sync", icon: RefreshCw },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

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
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    isCollapsed && "justify-center px-2"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                  {!isCollapsed && item.name}
                </Button>
              </Link>
            );
          })}
        </nav>

        <Separator className="my-4" />

        <nav className="space-y-1">
          {secondaryNavigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.name} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start",
                    isCollapsed && "justify-center px-2"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                  {!isCollapsed && item.name}
                </Button>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      {!isCollapsed && (
        <div className="p-4 border-t">
          <p className="text-xs text-muted-foreground text-center">
            v1.0.0 &middot; Last sync: Just now
          </p>
        </div>
      )}
    </div>
  );
}
