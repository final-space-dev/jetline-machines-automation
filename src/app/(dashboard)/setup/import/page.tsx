"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { useRole } from "@/lib/use-role";

// Insertable equipment.items columns — order defines the template CSV header row.
const COLUMNS = [
  "store", "machine_type", "make_model", "serial", "condition",
  "located_at", "status", "purchase_date", "supplier",
  "purchase_price", "warranty_expiry",
] as const;

type Col = (typeof COLUMNS)[number];
type Row = Record<Col, string>;

interface ParsedRow {
  index: number;
  data: Row;
  valid: boolean;
  reason: string | null;
}

const S: Record<string, React.CSSProperties> = {
  page: { fontFamily: "var(--jl-font)", background: "var(--jl-canvas)", color: "var(--jl-ink-900)", minHeight: "100%", padding: "28px 40px 60px" },
  surface: { background: "var(--jl-surface)", boxShadow: "var(--jl-sh-sm)", borderRadius: "var(--jl-r-lg)", overflow: "hidden" },
  btnPrimary: {
    display: "inline-flex", alignItems: "center", gap: 7, height: 38, padding: "0 18px",
    borderRadius: "var(--jl-r-sm)", background: "var(--jl-red-500)", color: "#fff",
    fontSize: 13, fontWeight: 700, fontFamily: "var(--jl-font)", cursor: "pointer",
    border: "none", boxShadow: "var(--jl-sh-red)", whiteSpace: "nowrap",
  },
  btnGhost: {
    display: "inline-flex", alignItems: "center", gap: 7, height: 38, padding: "0 14px",
    borderRadius: "var(--jl-r-sm)", background: "var(--jl-surface)", color: "var(--jl-ink-700)",
    fontSize: 13, fontWeight: 700, fontFamily: "var(--jl-font)", cursor: "pointer",
    border: "1.5px solid var(--jl-ink-200)",
  },
  th: {
    padding: "9px 12px", textAlign: "left", fontSize: 11, fontWeight: 800,
    letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--jl-ink-400)",
    borderBottom: "1.5px solid var(--jl-ink-100)", whiteSpace: "nowrap", background: "var(--jl-surface-sunken)",
  },
  td: { padding: "10px 12px", fontSize: 12, color: "var(--jl-ink-800)", borderBottom: "1px solid var(--jl-ink-50)", whiteSpace: "nowrap" },
};

function emptyRow(): Row {
  return COLUMNS.reduce((acc, c) => { acc[c] = ""; return acc; }, {} as Row);
}

function validateRow(data: Row): { valid: boolean; reason: string | null } {
  if (!data.store?.trim()) return { valid: false, reason: "Missing store" };
  if (!data.machine_type?.trim()) return { valid: false, reason: "Missing machine_type" };
  return { valid: true, reason: null };
}

export default function ImportPage() {
  const { isAdmin, loading } = useRole();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const validCount = useMemo(() => rows.filter((r) => r.valid).length, [rows]);
  const invalidCount = rows.length - validCount;

  function downloadTemplate() {
    const header = COLUMNS.join(",");
    const example = [
      "Alberton", "Guillotine", "Ideal 4850", "SN-000123", "Good",
      "Front counter", "active", "2023-04-15", "Antalis",
      "18500", "2026-04-15",
    ].join(",");
    const csv = `${header}\n${example}\n`;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "equipment-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (result) => {
        const parsed: ParsedRow[] = result.data.map((raw, i) => {
          const data = emptyRow();
          for (const c of COLUMNS) data[c] = (raw[c] ?? "").toString().trim();
          const { valid, reason } = validateRow(data);
          return { index: i, data, valid, reason };
        });
        setRows(parsed);
        if (parsed.length === 0) toast.error("No rows found in file");
      },
      error: () => toast.error("Failed to parse CSV"),
    });
    e.target.value = "";
  }

  async function doImport() {
    const payload = rows.filter((r) => r.valid).map((r) => r.data);
    if (payload.length === 0) { toast.error("No valid rows to import"); return; }
    setImporting(true);
    try {
      const res = await fetch("/api/equipment/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await res.json().catch(() => null);
      if (!res.ok) throw new Error(j?.error || "Import failed");
      toast.success(`${j.imported} imported${j.skipped ? `, ${j.skipped} skipped` : ""}`);
      setRows([]);
      setFileName(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div style={{ ...S.page }}>
          <div style={{ color: "var(--jl-ink-300)", fontSize: 13 }}>Loading…</div>
        </div>
      </AppShell>
    );
  }

  if (!isAdmin) {
    return (
      <AppShell>
        <div style={{ ...S.page }}>
          <div style={{ ...S.surface, padding: 40, textAlign: "center", color: "var(--jl-ink-500)" }}>
            You need admin access to import equipment.
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div style={S.page}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, marginBottom: 18 }}>
          <span style={{ color: "var(--jl-ink-400)", fontWeight: 600 }}>Setup</span>
          <span style={{ color: "var(--jl-ink-300)" }}>/</span>
          <span style={{ color: "var(--jl-ink-800)", fontWeight: 700 }}>Import Equipment</span>
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--jl-ink-900)", lineHeight: 1.1, marginBottom: 20 }}>
          Import Equipment
        </h1>

        {/* Actions */}
        <div style={{ ...S.surface, padding: 20, marginBottom: 22, display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <button type="button" style={S.btnGhost} onClick={downloadTemplate}>
            <Download size={15} /> Download template CSV
          </button>
          <button type="button" style={S.btnPrimary} onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Choose CSV file
          </button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} style={{ display: "none" }} />
          {fileName && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--jl-ink-600)" }}>
              <FileSpreadsheet size={15} style={{ color: "var(--jl-ink-400)" }} /> {fileName}
            </span>
          )}
        </div>

        {rows.length > 0 && (
          <>
            {/* Summary + import action */}
            <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 14, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "var(--jl-green-700)" }}>
                <CheckCircle2 size={15} /> {validCount} valid row{validCount !== 1 ? "s" : ""}
              </span>
              {invalidCount > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 700, color: "var(--jl-red-700)" }}>
                  <AlertTriangle size={15} /> {invalidCount} row{invalidCount !== 1 ? "s" : ""} with errors
                </span>
              )}
              <button
                type="button"
                disabled={importing || validCount === 0}
                style={{ ...S.btnPrimary, marginLeft: "auto", opacity: importing || validCount === 0 ? 0.5 : 1, cursor: importing || validCount === 0 ? "default" : "pointer" }}
                onClick={doImport}
              >
                <Upload size={15} /> {importing ? "Importing…" : `Import ${validCount} valid row${validCount !== 1 ? "s" : ""}`}
              </button>
            </div>

            {/* Preview */}
            <div style={S.surface}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={S.th}>#</th>
                      {COLUMNS.map((c) => (<th key={c} style={S.th}>{c}</th>))}
                      <th style={S.th}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.index} style={{ background: r.valid ? "transparent" : "var(--jl-red-tint)" }}>
                        <td style={{ ...S.td, color: "var(--jl-ink-400)", fontWeight: 700 }}>{r.index + 1}</td>
                        {COLUMNS.map((c) => (
                          <td key={c} style={S.td}>
                            {r.data[c] || <span style={{ color: "var(--jl-ink-300)", fontStyle: "italic" }}>—</span>}
                          </td>
                        ))}
                        <td style={S.td}>
                          {r.valid ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--jl-green-700)", fontWeight: 700, fontSize: 11 }}>
                              <CheckCircle2 size={13} /> Valid
                            </span>
                          ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--jl-red-700)", fontWeight: 700, fontSize: 11 }}>
                              <AlertTriangle size={13} /> {r.reason}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "10px 14px", borderTop: "1px solid var(--jl-ink-100)", fontSize: 12, color: "var(--jl-ink-400)", fontWeight: 600 }}>
                {rows.length} row{rows.length !== 1 ? "s" : ""} parsed · Only valid rows will be imported
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
