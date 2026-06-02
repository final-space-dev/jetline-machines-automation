"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Printer,
  Settings,
  ChevronLeft,
  Menu,
  ScanLine,
} from "lucide-react";

interface SidebarProps {
  isCollapsed: boolean;
  onToggle: () => void;
}

type NavItem = { name: string; href: string; icon: typeof Printer };

const mainNavigation: NavItem[] = [
  { name: "Xerox Reporting", href: "/xerox-reporting", icon: ScanLine },
];

const secondaryNavigation: NavItem[] = [
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

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

        <Separator className="my-4" />

        <nav className="space-y-1">
          {secondaryNavigation.map((item) => <NavButton key={item.href} item={item} />)}
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
