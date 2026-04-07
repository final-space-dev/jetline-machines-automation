"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { AppShell } from "@/components/layout/app-shell";
import { PageLoading } from "@/components/ui/page-loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Save, X } from "lucide-react";
import * as XLSX from "xlsx";

// Lazy-load the entire pivot wrapper to avoid SSR issues
const PivotWrapper = dynamic(() => import("./pivot-wrapper"), {
  ssr: false,
  loading: () => <PageLoading variant="table" />,
});

// Error boundary to catch pivot rendering crashes
class PivotErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: () => void },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; onError: () => void }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="text-center py-10 text-muted-foreground">
          <p className="text-sm">Pivot view reset due to stale saved state.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => this.setState({ hasError: false })}>
            Reload
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface SavedPivotView {
  id: string;
  name: string;
  createdAt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pivotState: Record<string, any>;
}

export default function PerformancePage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any[]>([]);
  const [rowCount, setRowCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hasData, setHasData] = useState(true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [pivotState, setPivotState] = useState<Record<string, any>>({});
  const pivotRef = useRef<HTMLDivElement>(null);

  const [savedViews, setSavedViews] = useState<SavedPivotView[]>([]);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newViewName, setNewViewName] = useState("");

  // Load saved views from DB + performance data on mount
  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        const [perfRes, viewsRes] = await Promise.all([
          fetch("/api/performance"),
          fetch("/api/pivot-views"),
        ]);
        const perfJson = await perfRes.json();
        setData(perfJson.data ?? []);
        setRowCount(perfJson.rowCount ?? 0);
        setHasData((perfJson.data ?? []).length > 0);

        if (viewsRes.ok) {
          const views: SavedPivotView[] = await viewsRes.json();
          setSavedViews(views);
        }
      } catch (err) {
        console.error("Performance fetch error:", err);
        setHasData(false);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  const handlePivotChange = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (state: Record<string, any>) => {
      setPivotState(state);
    },
    [],
  );

  // --- View management (DB-backed) ---
  const saveView = async () => {
    const name = newViewName.trim();
    if (!name) return;
    try {
      const res = await fetch("/api/pivot-views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, pivotState }),
      });
      if (res.ok) {
        const view: SavedPivotView = await res.json();
        setSavedViews((prev) => [...prev, view]);
        setActiveViewId(view.id);
      }
    } catch (err) {
      console.error("Failed to save view:", err);
    }
    setShowSaveDialog(false);
    setNewViewName("");
  };

  const loadView = (view: SavedPivotView) => {
    setPivotState(view.pivotState);
    setActiveViewId(view.id);
  };

  const deleteView = async (viewId: string) => {
    try {
      await fetch(`/api/pivot-views?id=${viewId}`, { method: "DELETE" });
      setSavedViews((prev) => prev.filter((v) => v.id !== viewId));
      if (activeViewId === viewId) {
        setActiveViewId(null);
      }
    } catch (err) {
      console.error("Failed to delete view:", err);
    }
  };

  const resetToDefault = () => {
    setPivotState({});
    setActiveViewId(null);
  };

  // --- Export ---
  const handleExportPivot = () => {
    const table = pivotRef.current?.querySelector("table.pvtTable");
    if (!table) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table as HTMLTableElement);
    XLSX.utils.book_append_sheet(wb, ws, "Pivot");
    XLSX.writeFile(wb, `performance-pivot-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleExportRaw = () => {
    if (data.length === 0) return;
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Raw Data");
    XLSX.writeFile(wb, `performance-raw-${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  if (loading) {
    return (
      <AppShell>
        <PageLoading variant="table" />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-2">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">Performance</h1>
            {rowCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {rowCount.toLocaleString()} rows &middot; Drag fields to pivot
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleExportPivot}
              disabled={data.length === 0}
            >
              <Download className="h-3 w-3 mr-1" />
              Export Pivot
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={handleExportRaw}
              disabled={data.length === 0}
            >
              <Download className="h-3 w-3 mr-1" />
              Export Raw
            </Button>
          </div>
        </div>

        {/* Saved Views Bar */}
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            variant={!activeViewId ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={resetToDefault}
          >
            Default
          </Button>
          {savedViews.map((view) => (
            <div key={view.id} className="flex items-center group">
              <Button
                variant={activeViewId === view.id ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs pr-1"
                onClick={() => loadView(view)}
              >
                {view.name}
              </Button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  deleteView(view.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={() => setShowSaveDialog(true)}
          >
            <Save className="h-3 w-3 mr-1" />
            Save view
          </Button>
        </div>

        {/* Pivot Table */}
        {!hasData ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-sm">No reading data available.</p>
            <p className="text-xs mt-1">Sync BMS data first.</p>
          </div>
        ) : (
          <div ref={pivotRef} className="pivot-container">
            <PivotErrorBoundary onError={resetToDefault}>
              <PivotWrapper
                data={data}
                pivotState={pivotState}
                onPivotChange={handlePivotChange}
              />
            </PivotErrorBoundary>
          </div>
        )}
      </div>

      {/* Save View Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>Save Pivot View</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Input
              placeholder="View name"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveView();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={saveView} disabled={!newViewName.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
