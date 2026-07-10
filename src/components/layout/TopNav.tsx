"use client";

import { BarChart3, Printer, Shuffle, Settings, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ViewMode } from "@/types";

interface TopNavProps {
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  onSync?: () => void;
  isSyncing?: boolean;
}

export function TopNav({ viewMode, onViewChange, onSync, isSyncing }: TopNavProps) {
  const navItems = [
    { mode: "dashboard" as ViewMode, icon: BarChart3, label: "Dashboard" },
    { mode: "machines" as ViewMode, icon: Printer, label: "Machines" },
    { mode: "warroom" as ViewMode, icon: Shuffle, label: "War Room" },
    { mode: "settings" as ViewMode, icon: Settings, label: "Settings" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-red-700 border-red-800 shadow-lg">
      <div className="flex h-12 items-center px-3 lg:px-6">
        <div className="flex items-center gap-4 lg:gap-6 flex-1">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-white rounded flex items-center justify-center">
              <Printer className="h-4 w-4 text-red-700" />
            </div>
            <span className="text-white font-semibold text-sm lg:text-base hidden sm:inline">
              Jetline Machines
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex flex-row items-center gap-1">
            {navItems.map((item) => (
              <button
                key={item.mode}
                onClick={() => onViewChange(item.mode)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2 py-1.5 lg:px-3 lg:py-2 text-xs lg:text-sm font-medium transition-all hover:scale-105",
                  viewMode === item.mode
                    ? "bg-red-900 text-white shadow-md"
                    : "text-red-100 hover:bg-red-800/50 hover:text-white"
                )}
              >
                <item.icon className="h-3.5 w-3.5 lg:h-4 lg:w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {onSync && (
            <button
              onClick={onSync}
              disabled={isSyncing}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-2 py-1.5 lg:px-3 lg:py-2 text-xs lg:text-sm font-medium transition-all",
                "text-red-100 hover:bg-red-800/50 hover:text-white",
                isSyncing && "opacity-50 cursor-not-allowed"
              )}
            >
              <RefreshCw className={cn("h-3.5 w-3.5 lg:h-4 lg:w-4", isSyncing && "animate-spin")} />
              <span className="hidden sm:inline">{isSyncing ? "Syncing..." : "Sync Data"}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
