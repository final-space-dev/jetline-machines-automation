"use client";

import { useSync, SyncCompanyResult } from "@/contexts/sync-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  X,
  Minimize2,
  Maximize2,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Database,
  Building2,
  FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils";
import { useState, useEffect } from "react";

function CompanyRow({ result }: { result: SyncCompanyResult }) {
  const statusIcon = {
    pending: <Clock className="h-3 w-3 text-muted-foreground" />,
    syncing: <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />,
    completed: <CheckCircle className="h-3 w-3 text-green-500" />,
    error: <XCircle className="h-3 w-3 text-red-500" />,
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between py-2 px-3 text-xs border-b last:border-0",
        result.status === "syncing" && "bg-blue-50",
        result.status === "error" && "bg-red-50"
      )}
    >
      <div className="flex items-center gap-2">
        {statusIcon[result.status]}
        <span className="font-medium">{result.company}</span>
      </div>
      <div className="flex items-center gap-3 text-muted-foreground">
        {result.status === "completed" || result.status === "error" ? (
          <>
            <span className="font-mono">{result.machines} machines</span>
            <span className="font-mono">{formatNumber(result.readings)} readings</span>
            {result.errors > 0 && (
              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                {result.errors} errors
              </Badge>
            )}
            <span className="text-[10px]">{(result.duration / 1000).toFixed(1)}s</span>
          </>
        ) : result.status === "syncing" ? (
          <span className="text-blue-600">Syncing...</span>
        ) : (
          <span>Waiting...</span>
        )}
      </div>
    </div>
  );
}

export function SyncProgressPanel() {
  const { syncState, closePanel } = useSync();
  const [isMinimized, setIsMinimized] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Update elapsed time every second while syncing
  useEffect(() => {
    if (!syncState.isSyncing || !syncState.startedAt) {
      return;
    }

    // Initialize elapsed immediately
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

  const completedCount = syncState.companyResults.filter(
    (r) => r.status === "completed" || r.status === "error"
  ).length;
  const totalCount = syncState.companyResults.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

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

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[420px] bg-card border rounded-lg shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/50 rounded-t-lg">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">BMS Sync</span>
          {syncState.isSyncing && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {elapsed}s
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
              ? `Syncing ${completedCount} of ${totalCount} companies...`
              : syncState.error
              ? "Sync failed"
              : `Completed ${totalCount} companies`}
          </span>
          <span className="font-mono font-medium">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Stats Summary */}
      {(syncState.totalMachines > 0 || syncState.totalReadings > 0) && (
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
      )}

      {/* Company List */}
      <ScrollArea className="h-[240px]">
        {syncState.companyResults.length > 0 ? (
          syncState.companyResults.map((result, index) => (
            <CompanyRow key={index} result={result} />
          ))
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {syncState.isSyncing ? "Preparing sync..." : "No sync data"}
          </div>
        )}
      </ScrollArea>

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
