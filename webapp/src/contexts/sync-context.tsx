"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface SyncCompanyResult {
  company: string;
  machines: number;
  readings: number;
  errors: number;
  duration: number;
  status: "pending" | "syncing" | "completed" | "error";
}

export interface SyncState {
  isOpen: boolean;
  isSyncing: boolean;
  currentCompany: string | null;
  progress: number;
  startedAt: Date | null;
  completedAt: Date | null;
  companyResults: SyncCompanyResult[];
  totalMachines: number;
  totalReadings: number;
  error: string | null;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
  timestamp: Date;
  read: boolean;
}

interface SyncContextType {
  syncState: SyncState;
  notifications: Notification[];
  unreadCount: number;
  startSync: () => Promise<void>;
  togglePanel: () => void;
  closePanel: () => void;
  markNotificationRead: (id: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
}

const initialSyncState: SyncState = {
  isOpen: false,
  isSyncing: false,
  currentCompany: null,
  progress: 0,
  startedAt: null,
  completedAt: null,
  companyResults: [],
  totalMachines: 0,
  totalReadings: 0,
  error: null,
};

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncState, setSyncState] = useState<SyncState>(initialSyncState);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((notification: Omit<Notification, "id" | "timestamp" | "read">) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      read: false,
    };
    setNotifications((prev) => [newNotification, ...prev].slice(0, 50)); // Keep last 50
  }, []);

  const startSync = useCallback(async () => {
    setSyncState((prev) => ({
      ...prev,
      isOpen: true,
      isSyncing: true,
      currentCompany: null,
      progress: 0,
      startedAt: new Date(),
      completedAt: null,
      companyResults: [],
      totalMachines: 0,
      totalReadings: 0,
      error: null,
    }));

    addNotification({
      title: "Sync Started",
      message: "Full BMS sync initiated",
      type: "info",
    });

    try {
      // First, get the list of companies to show progress
      const companiesRes = await fetch("/api/companies");
      const companiesData = await companiesRes.json();

      // Handle API error responses
      const companies = Array.isArray(companiesData) ? companiesData : [];

      // Initialize company results
      const initialResults: SyncCompanyResult[] = companies
        .filter((c: { isActive: boolean }) => c.isActive)
        .map((c: { name: string }) => ({
          company: c.name,
          machines: 0,
          readings: 0,
          errors: 0,
          duration: 0,
          status: "pending" as const,
        }));

      setSyncState((prev) => ({
        ...prev,
        companyResults: initialResults,
      }));

      // Start the actual sync
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "full" }),
      });

      const data = await res.json();

      if (data.success) {
        // Update with final results
        const finalResults: SyncCompanyResult[] = data.companyResults.map((r: {
          company: string;
          machines: number;
          readings: number;
          errors: number;
          duration: number;
        }) => ({
          company: r.company,
          machines: r.machines,
          readings: r.readings,
          errors: r.errors,
          duration: r.duration,
          status: r.errors > 0 ? "error" : "completed",
        }));

        setSyncState((prev) => ({
          ...prev,
          isSyncing: false,
          progress: 100,
          completedAt: new Date(),
          companyResults: finalResults,
          totalMachines: data.summary.totalMachines,
          totalReadings: data.summary.totalReadings,
        }));

        addNotification({
          title: "Sync Completed",
          message: `Synced ${data.summary.totalMachines} machines and ${data.summary.totalReadings} readings`,
          type: "success",
        });
      } else {
        throw new Error(data.details || "Sync failed");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      setSyncState((prev) => ({
        ...prev,
        isSyncing: false,
        completedAt: new Date(),
        error: errorMessage,
      }));

      addNotification({
        title: "Sync Failed",
        message: errorMessage,
        type: "error",
      });
    }
  }, [addNotification]);

  const togglePanel = useCallback(() => {
    setSyncState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  }, []);

  const closePanel = useCallback(() => {
    setSyncState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <SyncContext.Provider
      value={{
        syncState,
        notifications,
        unreadCount,
        startSync,
        togglePanel,
        closePanel,
        markNotificationRead,
        markAllRead,
        clearNotifications,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error("useSync must be used within a SyncProvider");
  }
  return context;
}
