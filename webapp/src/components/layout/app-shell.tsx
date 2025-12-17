"use client";

import { useState } from "react";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

interface AppShellProps {
  children: React.ReactNode;
  lastSync?: string | null;
  onSync?: () => void;
  isSyncing?: boolean;
}

export function AppShell({ children, lastSync, onSync, isSyncing }: AppShellProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <Sidebar isCollapsed={isCollapsed} onToggle={() => setIsCollapsed(!isCollapsed)} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header lastSync={lastSync} onSync={onSync} isSyncing={isSyncing} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
