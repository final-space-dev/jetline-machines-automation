"use client";

import * as React from "react";
import { CheckCircle, Database, Maximize2, Minimize2, X, XCircle } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KeyValueList } from "@/components/ui/key-value-list";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { useSync } from "@/contexts/sync-context";
import { formatNumber } from "@/lib/utils";
import { SURFACE, TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";

const elapsedWords = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);

/** The BMS sync as it runs: a floating panel bottom right, or one button when minimised. */
export function SyncPanel() {
  const { syncState, closePanel } = useSync();
  const [minimised, setMinimised] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    if (!syncState.isSyncing || !syncState.startedAt) return;
    const started = syncState.startedAt.getTime();
    const t = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => {
      clearInterval(t);
      setElapsed(0);
    };
  }, [syncState.isSyncing, syncState.startedAt]);

  if (!syncState.isOpen) return null;
  const progress = Math.round(syncState.progress);
  const state = syncState.isSyncing ? "running" : syncState.error ? "failed" : "done";

  if (minimised) {
    return (
      <div className="fixed right-4 bottom-4 z-50 print:hidden">
        <Button size="sm" onClick={() => setMinimised(false)}>
          {state === "running" ? <Spinner /> : state === "failed" ? <XCircle /> : <CheckCircle />}
          {state === "running" ? `Syncing ${progress}%` : state === "failed" ? "Sync failed" : "Sync complete"}
          <Maximize2 />
        </Button>
      </div>
    );
  }

  return (
    <section className={cn(SURFACE.cardRaised, "fixed right-4 bottom-4 z-50 flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-3 p-4 print:hidden")}>
      <div className="flex items-center justify-between gap-2">
        <span className={cn(TYPE.section, "flex items-center gap-2")}>
          <Database className="size-4 text-muted-foreground" />
          BMS sync
          {syncState.isSyncing && <Badge status="info">{elapsedWords(elapsed)}</Badge>}
        </span>
        <span className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Minimise" onClick={() => setMinimised(true)}>
            <Minimize2 />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Close" disabled={syncState.isSyncing} onClick={closePanel}>
            <X />
          </Button>
        </span>
      </div>
      <Progress
        label={state === "running" ? syncState.currentCompany || "Starting" : state === "failed" ? "Sync failed" : "Sync complete"}
        value={progress}
        valueLabel={`${progress}%`}
        tone={state === "failed" ? "danger" : state === "done" ? "success" : "accent"}
      />
      <KeyValueList
        items={[
          ...(syncState.isSyncing && syncState.totalCompanies > 0
            ? [{ label: "Companies", value: `${syncState.companiesProcessed} of ${syncState.totalCompanies}` }]
            : []),
          { label: "Machines", value: formatNumber(syncState.totalMachines) },
          { label: "Readings", value: formatNumber(syncState.totalReadings) },
        ]}
      />
      {syncState.error && (
        <Alert variant="destructive">
          <AlertTitle>{syncState.error}</AlertTitle>
        </Alert>
      )}
    </section>
  );
}
