"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Download, Upload, FileText, CheckCircle2, AlertTriangle, X } from "lucide-react";
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
type Column = (typeof COLUMNS)[number];

// One example row so the format is obvious. Uses placeholder-but-valid shapes.
const EXAMPLE_ROW: Record<Column, string> = {
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
  const fileRef = useRef<HTMLInputElement>(null);

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
        const colIndex = new Map<Column, number>();
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
    if (fileRef.current) fileRef.current.value = "";
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

  if (!isAdmin) {
    return (
      <div className="jl-card jl-card--pad-lg">
        <span className="jl-sm jl-muted">Import is available to administrators only.</span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Intro + template download */}
      <div className="jl-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ maxWidth: 620 }}>
            <div className="jl-h3" style={{ color: "var(--ink-900)", marginBottom: 4 }}>Mass-import equipment</div>
            <p className="jl-sm jl-muted" style={{ lineHeight: 1.5 }}>
              Download the template, fill in one row per item (every attribute except images),
              then upload it here. You&apos;ll see a preview before anything is saved.
            </p>
          </div>
          <button type="button" className="jl-btn jl-btn--soft" onClick={downloadTemplate}>
            <Download size={16} /> Download template
          </button>
        </div>

        {/* Upload control */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
          />
          <button type="button" className="jl-btn jl-btn--primary" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Choose CSV file
          </button>
          {fileName && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-600)" }}>
              <FileText size={15} /> {fileName}
              <button type="button" className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm" onClick={reset} aria-label="Clear file">
                <X size={14} />
              </button>
            </span>
          )}
        </div>
      </div>

      {parseError && (
        <div className="jl-alert jl-alert--red" role="alert">
          <span className="jl-chip jl-chip--solid"><AlertTriangle size={16} /></span>
          <div className="jl-alert__body">
            <div className="jl-alert__title">Couldn&apos;t read that file</div>
            <div className="jl-alert__text">{parseError}</div>
          </div>
        </div>
      )}

      {/* Preview */}
      {rows.length > 0 && !result && (
        <div className="jl-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="jl-h3" style={{ color: "var(--ink-900)" }}>Preview</span>
            <span className="jl-badge jl-badge--green">{validCount} ready</span>
            {blockingRows.size > 0 && <span className="jl-badge jl-badge--red">{blockingRows.size} will be skipped</span>}
            {issues.length - blockingRows.size > 0 && (
              <span className="jl-badge jl-badge--amber">{issues.length - blockingRows.size} warnings</span>
            )}
          </div>

          {issues.length > 0 && (
            <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid var(--ink-100)", borderRadius: "var(--r-md)" }}>
              <table className="jl-table" style={{ minWidth: 0 }}>
                <thead><tr><th style={{ width: 70 }}>Row</th><th>Issue</th></tr></thead>
                <tbody>
                  {issues.map((iss, k) => (
                    <tr key={k}>
                      <td className="cell-strong">{iss.row}</td>
                      <td style={{ color: iss.reason.includes("required") ? "var(--red-600)" : "var(--amber-700)" }}>{iss.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* First few rows as a sanity check */}
          <div style={{ overflowX: "auto" }}>
            <table className="jl-table" style={{ minWidth: 900 }}>
              <thead>
                <tr>{COLUMNS.slice(0, 8).map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((r, i) => (
                  <tr key={i}>
                    {COLUMNS.slice(0, 8).map((c) => (
                      <td key={c} style={{ color: "var(--ink-600)", whiteSpace: "nowrap" }}>{r[c] || <span className="jl-muted">—</span>}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 5 && <span className="jl-sm jl-muted">Showing 5 of {rows.length} rows.</span>}

          {/* Mode + commit */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <label className="jl-switch" title="Update items whose serial already exists (instead of creating duplicates)">
              <input type="checkbox" checked={mode === "upsert"} onChange={(e) => setMode(e.target.checked ? "upsert" : "create")} />
              <span className="track" />
              <span className="thumb" />
              <span className="label">Update existing items matched by serial</span>
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {committing && <span className="jl-spinner jl-spinner--sm" />}
              <button type="button" className="jl-btn jl-btn--ghost" onClick={reset} disabled={committing}>Cancel</button>
              <button type="button" className="jl-btn jl-btn--primary" onClick={commit} disabled={committing || validCount === 0}>
                Import {validCount} item{validCount !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="jl-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <CheckCircle2 size={20} style={{ color: "var(--green-600)" }} />
            <span className="jl-h3" style={{ color: "var(--ink-900)" }}>Import complete</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span className="jl-badge jl-badge--green">{result.imported} created</span>
            {result.updated > 0 && <span className="jl-badge jl-badge--blue">{result.updated} updated</span>}
            {result.skipped > 0 && <span className="jl-badge jl-badge--red">{result.skipped} skipped</span>}
          </div>
          {result.errors.length > 0 && (
            <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid var(--ink-100)", borderRadius: "var(--r-md)" }}>
              <table className="jl-table" style={{ minWidth: 0 }}>
                <thead><tr><th style={{ width: 70 }}>Row</th><th>Reason</th></tr></thead>
                <tbody>
                  {result.errors.map((e, k) => (
                    <tr key={k}><td className="cell-strong">{e.row || "—"}</td><td style={{ color: "var(--red-600)" }}>{e.reason}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div>
            <button type="button" className="jl-btn jl-btn--soft" onClick={reset}>Import another file</button>
          </div>
        </div>
      )}
    </div>
  );
}
