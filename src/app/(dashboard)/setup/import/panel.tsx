"use client";

import { useCallback, useMemo, useState } from "react";
import { Download, FileText, Upload, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { DataTable, type Column } from "@/components/machines/data-table";
import { Empty } from "@/components/machines/empty";
import { FilePicker } from "@/components/machines/file-picker";
import { Muted, Panel } from "@/components/machines/panel";
import { TYPE } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";
import { useRole } from "@/lib/use-role";

/**
 * Equipment mass-import — the CRM bulk-load tool under Config.
 *
 * Flow: download the template (all attributes) -> fill it in -> upload the CSV
 * -> review a validation preview -> commit. Every attribute is importable except
 * images (which can't be attached from a spreadsheet). Backed by
 * POST /api/equipment/import (create or upsert-by-serial).
 */

// Template columns = every writable equipment attribute (order matches the API).
const COLUMNS = [
  "store", "machine_type", "make_model", "serial", "condition",
  "located_at", "status", "purchase_date", "supplier", "purchase_price",
  "warranty_expiry", "last_serviced", "next_service_due", "service_provider", "notes",
] as const;
type Field = (typeof COLUMNS)[number];

// One example row so the format is obvious. Uses placeholder-but-valid shapes.
const EXAMPLE_ROW: Record<Field, string> = {
  store: "Alberton",
  machine_type: "Guillotine",
  make_model: "Ideal 4850",
  serial: "SN-000123",
  condition: "Good",
  located_at: "Front counter",
  status: "active",
  purchase_date: "2024-01-15",
  supplier: "Antalis",
  purchase_price: "18500.00",
  warranty_expiry: "2027-01-15",
  last_serviced: "2026-02-01",
  next_service_due: "2026-08-01",
  service_provider: "Ideal SA",
  notes: "Blade replaced Feb 2026",
};

type ParsedRow = Record<string, string>;
interface RowIssue { row: number; reason: string }

// Minimal RFC-4180-ish CSV parser (handles quoted fields, commas, quotes, CRLF).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); field = ""; row = [];
    } else if (c === "\r") {
      // handled by the \n case; skip lone CR
    } else {
      field += c;
    }
  }
  // Trailing field/row (no final newline).
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

function csvCell(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

const VALID_STATUSES = new Set(["active", "inactive", "disposed", "transferred"]);

export function ImportPanel() {
  const { isAdmin } = useRole();

  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [mode, setMode] = useState<"create" | "upsert">("create");
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<{ imported: number; updated: number; skipped: number; errors: RowIssue[] } | null>(null);

  // ---- Template download ----
  const downloadTemplate = useCallback(() => {
    const header = COLUMNS.join(",");
    const example = COLUMNS.map((c) => csvCell(EXAMPLE_ROW[c])).join(",");
    const csv = `${header}\n${example}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "equipment-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  // ---- File parse ----
  const onFile = useCallback((file: File) => {
    setResult(null);
    setParseError(null);
    setRows([]);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const grid = parseCsv(String(reader.result ?? ""));
        if (grid.length < 1) { setParseError("The file is empty."); return; }
        const header = grid[0].map((h) => h.trim().toLowerCase());
        // Map header positions to known columns; ignore unknown columns.
        const colIndex = new Map<Field, number>();
        COLUMNS.forEach((c) => {
          const idx = header.indexOf(c);
          if (idx >= 0) colIndex.set(c, idx);
        });
        if (!colIndex.has("store") || !colIndex.has("machine_type")) {
          setParseError('The file must have at least "store" and "machine_type" columns. Download the template to see the expected headers.');
          return;
        }
        const parsed: ParsedRow[] = [];
        for (let r = 1; r < grid.length; r++) {
          const line = grid[r];
          const obj: ParsedRow = {};
          for (const c of COLUMNS) {
            const idx = colIndex.get(c);
            obj[c] = idx != null ? (line[idx] ?? "").trim() : "";
          }
          parsed.push(obj);
        }
        setRows(parsed);
      } catch {
        setParseError("Could not read the CSV file.");
      }
    };
    reader.onerror = () => setParseError("Could not read the file.");
    reader.readAsText(file);
  }, []);

  // ---- Validation preview ----
  const issues = useMemo<RowIssue[]>(() => {
    const out: RowIssue[] = [];
    rows.forEach((r, i) => {
      const rowNo = i + 1;
      if (!r.store) out.push({ row: rowNo, reason: "store is required" });
      if (!r.machine_type) out.push({ row: rowNo, reason: "machine_type is required" });
      if (r.status && !VALID_STATUSES.has(r.status.toLowerCase()))
        out.push({ row: rowNo, reason: `status "${r.status}" will default to "active"` });
      for (const dc of ["purchase_date", "warranty_expiry", "last_serviced", "next_service_due"] as const) {
        if (r[dc] && Number.isNaN(new Date(r[dc]).getTime()))
          out.push({ row: rowNo, reason: `${dc} "${r[dc]}" is not a valid date and will be blanked` });
      }
      if (r.purchase_price && !Number.isFinite(Number(r.purchase_price.replace(/[, ]/g, ""))))
        out.push({ row: rowNo, reason: `purchase_price "${r.purchase_price}" is not a number and will be blanked` });
    });
    return out;
  }, [rows]);

  const blockingRows = useMemo(
    () => new Set(issues.filter((i) => i.reason.includes("required")).map((i) => i.row)),
    [issues],
  );
  const validCount = rows.length - blockingRows.size;

  const reset = useCallback(() => {
    setFileName(null); setRows([]); setParseError(null); setResult(null);
  }, []);

  // ---- Commit ----
  const commit = useCallback(async () => {
    if (rows.length === 0) return;
    setCommitting(true);
    setResult(null);
    try {
      const res = await fetch("/api/equipment/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, mode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ imported: 0, updated: 0, skipped: rows.length, errors: [{ row: 0, reason: data.error || "Import failed" }] });
        return;
      }
      setResult({ imported: data.imported ?? 0, updated: data.updated ?? 0, skipped: data.skipped ?? 0, errors: data.errors ?? [] });
    } catch {
      setResult({ imported: 0, updated: 0, skipped: rows.length, errors: [{ row: 0, reason: "Network error" }] });
    } finally {
      setCommitting(false);
    }
  }, [rows, mode]);

  if (!isAdmin) return <Empty title="Import is available to administrators only" />;

  const issueColumns: Column<RowIssue>[] = [
    { key: "row", label: "Row", width: "w-20", cell: (iss) => <span className="font-medium tabular-nums">{iss.row || "—"}</span> },
    { key: "reason", label: "Issue", cell: (iss) => <span className={iss.reason.includes("required") || result ? "text-destructive" : undefined}>{iss.reason}</span> },
  ];
  // The first few rows as a sanity check.
  const previewColumns: Column<ParsedRow>[] = COLUMNS.slice(0, 8).map((c) => ({
    key: c,
    label: c,
    cell: (r) => <span className="whitespace-nowrap">{r[c] || <Muted>—</Muted>}</span>,
  }));

  return (
    <div className="flex w-full max-w-6xl flex-col gap-4">
      {/* Download the template, fill in a row per item (every attribute except images), upload it, check the preview. */}
      <Panel
        caption="Mass-import equipment"
        right={
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download /> Download template
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <FilePicker accept=".csv,text/csv" variant="default" size="default" onFiles={(files) => onFile(files[0])}>
            <Upload /> Choose CSV file
          </FilePicker>
          {fileName && (
            <span className={cn(TYPE.data, "inline-flex items-center gap-2 text-muted-foreground")}>
              <FileText className="size-4" /> {fileName}
              <Button variant="ghost" size="icon-sm" onClick={reset} aria-label="Clear file">
                <X />
              </Button>
            </span>
          )}
        </div>
      </Panel>

      {parseError && (
        <Alert variant="destructive" role="alert">
          <AlertTitle>Couldn&apos;t read that file</AlertTitle>
          <AlertDescription>{parseError}</AlertDescription>
        </Alert>
      )}

      {rows.length > 0 && !result && (
        <Panel
          caption="Preview"
          right={
            <>
              <Badge status="success">{validCount} ready</Badge>
              {blockingRows.size > 0 && <Badge status="danger">{blockingRows.size} will be skipped</Badge>}
              {issues.length - blockingRows.size > 0 && <Badge status="warning">{issues.length - blockingRows.size} warnings</Badge>}
            </>
          }
          bodyClassName="flex flex-col gap-4"
        >
          {issues.length > 0 && (
            <div className="max-h-48 overflow-y-auto">
              <DataTable columns={issueColumns} rows={issues} rowKey={(_, i) => i} card={false} />
            </div>
          )}

          <DataTable wide columns={previewColumns} rows={rows.slice(0, 5)} rowKey={(_, i) => i} card={false} />
          {rows.length > 5 && <Muted>Showing 5 of {rows.length} rows</Muted>}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5" title="Update items whose serial already exists (instead of creating duplicates)">
              <Switch id="import-upsert" checked={mode === "upsert"} onCheckedChange={(checked) => setMode(checked ? "upsert" : "create")} />
              <Label htmlFor="import-upsert">Update existing items matched by serial</Label>
            </div>
            <div className="flex items-center gap-2.5">
              <Button variant="outline" onClick={reset} disabled={committing}>Cancel</Button>
              <Button onClick={commit} disabled={committing || validCount === 0}>
                {committing && <Spinner />}
                Import {validCount} item{validCount !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </Panel>
      )}

      {result && (
        <Panel
          caption="Import complete"
          right={
            <>
              <Badge status="success">{result.imported} created</Badge>
              {result.updated > 0 && <Badge status="info">{result.updated} updated</Badge>}
              {result.skipped > 0 && <Badge status="danger">{result.skipped} skipped</Badge>}
            </>
          }
          bodyClassName="flex flex-col gap-4"
        >
          {result.errors.length > 0 && (
            <div className="max-h-48 overflow-y-auto">
              <DataTable columns={issueColumns} rows={result.errors} rowKey={(_, i) => i} card={false} />
            </div>
          )}
          <div>
            <Button variant="outline" onClick={reset}>Import another file</Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
