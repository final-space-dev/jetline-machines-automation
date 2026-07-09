"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { toast } from "sonner";
import { ChevronLeft, Plus } from "lucide-react";
import {
  EQUIPMENT_STATUSES, STATUS_CONFIG, EQUIPMENT_TYPES,
  type EquipmentStatus,
} from "@/lib/equipment-utils";
import { JlSelect } from "@/components/ui/jl-select";
import { ModelSuggest } from "@/components/equipment/model-suggest";

const CONDITION_OPTIONS = [
  { value: "Good", label: "Good" },
  { value: "Fair", label: "Fair" },
  { value: "Poor", label: "Poor" },
];

// ─── Add Equipment full-page form ──────────────────────────────────────────────

export default function AddEquipmentPage() {
  const params = useParams();
  const router = useRouter();
  const storeName = decodeURIComponent(params.store as string);

  const [type, setType] = useState("");
  const [makeModel, setMakeModel] = useState("");
  const [serial, setSerial] = useState("");
  const [status, setStatus] = useState<EquipmentStatus>("active");
  const [condition, setCondition] = useState("Good");
  const [saving, setSaving] = useState(false);

  const storeHref = `/equipment/stores/${encodeURIComponent(storeName)}`;

  const save = async () => {
    if (!type) { toast.error("Equipment type is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          store: storeName,
          machine_type: type,
          make_model: makeModel,
          serial,
          condition,
          status,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Equipment added");
      router.push(storeHref);
    } catch {
      toast.error("Failed to add equipment");
      setSaving(false);
    }
  };

  return (
    <AppShell>
      {/* Sticky top bar with breadcrumb + save */}
      <div
        className="jl-page-pad"
        style={{
          position: "sticky", top: 0, zIndex: 30,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 12, padding: "14px 40px", background: "var(--surface)",
          boxShadow: "var(--sh-sm)",
        }}
      >
        <nav className="jl-breadcrumb">
          <Link href="/equipment">Stores</Link>
          <span className="sep">/</span>
          <Link href={storeHref}>{storeName}</Link>
          <span className="sep">/</span>
          <span className="current">Add Equipment</span>
        </nav>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="jl-btn jl-btn--primary jl-btn--sm jl-touch-btn"
          data-loading={saving ? "" : undefined}
        >
          <Plus /> Save Equipment
        </button>
      </div>

      <div
        className="jl-page-pad"
        style={{ padding: "28px 40px 60px", maxWidth: 720, margin: "0 auto" }}
      >
        <div style={{ marginBottom: 20 }}>
          <Link
            href={storeHref}
            className="jl-btn jl-btn--ghost jl-btn--sm jl-touch-btn"
            style={{ marginBottom: 14 }}
          >
            <ChevronLeft /> Back to {storeName}
          </Link>
          <h1 className="jl-h1">Add Equipment</h1>
        </div>

        <div className="jl-card">
          <div style={{ display: "grid", gap: 18 }}>
            <div
              className="jl-add-grid"
              style={{ display: "grid", gridTemplateColumns: "1.2fr 1.5fr 1fr", gap: 14 }}
            >
              <div className="jl-field">
                <label>Type *</label>
                <JlSelect
                  value={type}
                  onChange={setType}
                  placeholder="Select type…"
                  options={EQUIPMENT_TYPES.map((t) => ({ value: t, label: t }))}
                />
              </div>
              <div className="jl-field">
                <label>Make / Model</label>
                <ModelSuggest value={makeModel} onChange={setMakeModel} placeholder="Search or add model…" />
              </div>
              <div className="jl-field">
                <label>Serial</label>
                <input
                  className="jl-input jl-mono"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  placeholder="Serial…"
                />
              </div>
            </div>

            <div
              className="jl-add-grid"
              style={{ display: "grid", gridTemplateColumns: "1fr 240px", gap: 24, alignItems: "flex-start" }}
            >
              <div className="jl-field">
                <label>Status</label>
                <div className="jl-segment" role="tablist" aria-label="Status">
                  {EQUIPMENT_STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="tab"
                      aria-selected={status === s}
                      onClick={() => setStatus(s)}
                      className="jl-touch-toggle"
                    >
                      {STATUS_CONFIG[s].label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="jl-field">
                <label>Condition</label>
                <JlSelect value={condition} onChange={setCondition} options={CONDITION_OPTIONS} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
              <Link href={storeHref} className="jl-btn jl-btn--ghost jl-touch-btn">
                Cancel
              </Link>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="jl-btn jl-btn--primary jl-touch-btn"
                data-loading={saving ? "" : undefined}
              >
                <Plus /> Save Equipment
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
