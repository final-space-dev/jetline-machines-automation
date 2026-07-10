"use client";

import { useSync } from "@/contexts/sync-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  X,
  Minimize2,
  Maximize2,
  CheckCircle,
  XCircle,
  Loader2,
  Database,
  Building2,
  FileText,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { useState, useEffect } from "react";

export function SyncProgressPanel() {
  const { syncState, closePanel } = useSync();
  const [isMinimized, setIsMinimized] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Update elapsed time every second while syncing
  useEffect(() => {
    if (!syncState.isSyncing || !syncState.startedAt) {
      return;
    }

    const startTime = syncState.startedAt.getTime();

    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - startTime) / 1000));
    }, 1000);

    return () => {
      clearInterval(interval);
      setElapsed(0);
    };
  }, [syncState.isSyncing, syncState.startedAt]);

  if (!syncState.isOpen) return null;

  const progress = syncState.progress;

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsMinimized(false)}
          className="gap-2 shadow-lg"
          size="sm"
        >
          {syncState.isSyncing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Syncing... {Math.round(progress)}%
            </>
          ) : syncState.error ? (
            <>
              <XCircle className="h-4 w-4" />
              Sync Failed
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4" />
              Sync Complete
            </>
          )}
          <Maximize2 className="h-3 w-3 ml-1" />
        </Button>
      </div>
    );
  }

  const formatElapsed = (s: number) => {
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}m ${rem}s`;
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[380px] bg-card border rounded-lg shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">BMS Sync</span>
          {syncState.isSyncing && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {formatElapsed(elapsed)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsMinimized(true)}
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={closePanel}
            disabled={syncState.isSyncing}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-muted-foreground">
            {syncState.isSyncing
              ? syncState.currentCompany || "Starting sync..."
              : syncState.error
              ? "Sync failed"
              : "Sync completed"}
          </span>
          <span className="font-mono font-medium">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
        {syncState.isSyncing && syncState.totalCompanies > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1">
            {syncState.companiesProcessed} of {syncState.totalCompanies} companies
          </p>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 px-4 py-3 border-b bg-muted/30">
        <div className="flex items-center gap-2 text-xs">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Machines:</span>
          <span className="font-mono font-medium">{formatNumber(syncState.totalMachines)}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Readings:</span>
          <span className="font-mono font-medium">{formatNumber(syncState.totalReadings)}</span>
        </div>
      </div>

      {/* Error Message */}
      {syncState.error && (
        <div className="px-4 py-3 border-t bg-red-50 text-xs text-red-700 rounded-b-lg">
          <strong>Error:</strong> {syncState.error}
        </div>
      )}

      {/* Footer */}
      {!syncState.isSyncing && !syncState.error && syncState.completedAt && (
        <div className="px-4 py-2 border-t bg-green-50 text-xs text-green-700 rounded-b-lg flex items-center gap-2">
          <CheckCircle className="h-3.5 w-3.5" />
          Sync completed successfully
        </div>
      )}
    </div>
  );
}
