"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";

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
  totalCompanies: number;
  companiesProcessed: number;
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
  startSync: () => void;
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
  totalCompanies: 0,
  companiesProcessed: 0,
  error: null,
};

const SyncContext = createContext<SyncContextType | undefined>(undefined);

export function SyncProvider({ children }: { children: ReactNode }) {
  const [syncState, setSyncState] = useState<SyncState>(initialSyncState);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addNotification = useCallback((notification: Omit<Notification, "id" | "timestamp" | "read">) => {
    const newNotification: Notification = {
      ...notification,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      read: false,
    };
    setNotifications((prev) => [newNotification, ...prev].slice(0, 50));
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollSyncStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync?current=true");
      const data = await res.json();

      if (data.running) {
        const progress = data.totalCompanies > 0
          ? Math.round((data.companiesProcessed / data.totalCompanies) * 100)
          : 0;

        setSyncState((prev) => ({
          ...prev,
          isSyncing: true,
          isOpen: true,
          currentCompany: data.currentCompany,
          progress,
          totalMachines: data.machinesProcessed,
          totalReadings: data.readingsProcessed,
          totalCompanies: data.totalCompanies,
          companiesProcessed: data.companiesProcessed,
          startedAt: prev.startedAt || new Date(data.startedAt),
        }));
      } else {
        // Sync finished (or was never running)
        stopPolling();

        const last = data.lastCompleted;
        if (last) {
          setSyncState((prev) => {
            // Only update if we were actually tracking a sync
            if (!prev.isSyncing) return prev;

            return {
              ...prev,
              isSyncing: false,
              progress: 100,
              currentCompany: null,
              completedAt: new Date(last.completedAt),
              totalMachines: last.machinesProcessed,
              totalReadings: last.readingsProcessed,
              companiesProcessed: last.companiesProcessed,
              error: last.status === "FAILED" ? (last.errors || "Sync failed") : null,
            };
          });

          // Check if this was a completion we haven't notified about
          setSyncState((prev) => {
            if (prev.completedAt && prev.isSyncing === false && prev.progress === 100) {
              if (!prev.error) {
                addNotification({
                  title: "Sync Completed",
                  message: `Synced ${last.machinesProcessed} machines and ${last.readingsProcessed} readings`,
                  type: "success",
                });
              } else {
                addNotification({
                  title: "Sync Failed",
                  message: prev.error,
                  type: "error",
                });
              }
            }
            return prev;
          });
        }
      }
    } catch {
      // Network error during poll — keep trying
    }
  }, [addNotification, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    // Poll immediately, then every 2 seconds
    pollSyncStatus();
    pollingRef.current = setInterval(pollSyncStatus, 2000);
  }, [pollSyncStatus, stopPolling]);

  // On mount: check if there's already a running sync (page refresh recovery)
  useEffect(() => {
    const checkRunningSync = async () => {
      try {
        const res = await fetch("/api/sync?current=true");
        const data = await res.json();
        if (data.running) {
          // Restore syncing state and start polling
          setSyncState((prev) => ({
            ...prev,
            isSyncing: true,
            isOpen: true,
            startedAt: new Date(data.startedAt),
            currentCompany: data.currentCompany,
            totalCompanies: data.totalCompanies,
            companiesProcessed: data.companiesProcessed,
            totalMachines: data.machinesProcessed,
            totalReadings: data.readingsProcessed,
            progress: data.totalCompanies > 0
              ? Math.round((data.companiesProcessed / data.totalCompanies) * 100)
              : 0,
          }));
          startPolling();
        }
      } catch {
        // Ignore — server might be unreachable
      }
    };
    checkRunningSync();
    return stopPolling;
  }, [startPolling, stopPolling]);

  const startSync = useCallback(() => {
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
      totalCompanies: 0,
      companiesProcessed: 0,
      error: null,
    }));

    addNotification({
      title: "Sync Started",
      message: "Full BMS sync initiated",
      type: "info",
    });

    // Fire-and-forget: don't await the POST
    fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "full" }),
    }).catch(() => {
      // POST errors are caught via polling status
    });

    // Start polling for progress
    startPolling();
  }, [addNotification, startPolling]);

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
