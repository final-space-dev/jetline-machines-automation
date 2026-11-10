"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, Save, X } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { EquipmentErrorBoundary } from "@/components/equipment/error-boundary";
import { FeedbackPanel } from "@/components/equipment/feedback-panel";
import { ModelSuggest } from "@/components/equipment/model-suggest";
import { Bars } from "@/components/machines/charts";
import { DataTable, type Column } from "@/components/machines/data-table";
import { DayField } from "@/components/machines/day-field";
import { Field } from "@/components/machines/field";
import { Loading } from "@/components/machines/loading";
import { Page } from "@/components/machines/page";
import { Panel } from "@/components/machines/panel";
import { ReadField } from "@/components/machines/read-field";
import { ConditionBadge } from "@/components/machines/status-badge";
import { addRecentItem } from "@/lib/recently-viewed";
import { toast } from "@/lib/toast";
import { GRID } from "@/lib/ui/ui-tokens";
import { cn } from "@/lib/ui/utils";
import { useHotkeys } from "@/lib/use-hotkey";
import { useRole } from "@/lib/use-role";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PrinterDimensions {
  serial_number: string;
  model: string | null;
  manufacturer: string | null;
  last_seen: string | null;
  color_capable: boolean | null;
  duplex_capable: boolean | null;
}

interface PrinterMapping {
  store: string | null;
  printer_type: string | null;
  model_name: string | null;
  reporting_enabled: boolean | null;
}

interface PrinterFeedback {
  condition: string | null;
  condition_notes: string | null;
  install_date: string | null;            // Latest install (BMS, current store)
  original_install_date: string | null;   // First-ever install → drives Age
  contract_end: string | null;
  technician_notes: string | null;
  last_visit: string | null;
  supplier: string | null;
}

/** Age in years+months from the original install date, computed live. */
function ageFromDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = new Date();
  let months = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (now.getDate() < d.getDate()) months -= 1;
  if (months < 0) months = 0;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} month${m !== 1 ? "s" : ""}`;
  return m > 0 ? `${y}y ${m}m` : `${y} year${y !== 1 ? "s" : ""}`;
}

interface MeterReading {
  report_date: string;
  total: number | null;
  black: number | null;
  colour: number | null;
  a3: number | null;
  large: number | null;
}

type CounterKey = "total" | "black" | "colour" | "a3" | "large";

const COUNTER_TYPES: { key: CounterKey; label: string }[] = [
  { key: "total", label: "Total" },
  { key: "black", label: "Black" },
  { key: "colour", label: "Colour" },
  { key: "a3", label: "A3" },
  { key: "large", label: "A3 Colour" },
];

const CONDITION_OPTIONS = ["Good", "Fair", "Poor"].map((c) => ({ value: c, label: c }));

const longDay = (iso: string) => new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" });

const count = (key: CounterKey, label: string): Column<MeterReading> => ({
  key,
  label,
  align: "right",
  cell: (r) => <span className={cn(GRID.num, !r[key] && "text-faint")}>{r[key] != null ? (r[key] as number).toLocaleString("en-ZA") : "0"}</span>,
});

const READING_COLUMNS: Column<MeterReading>[] = [
  {
    key: "date",
    label: "Date",
    cell: (r) => <span className="font-medium">{new Date(r.report_date).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "2-digit" })}</span>,
  },
  count("total", "Total"),
  count("black", "Black"),
  count("colour", "Colour"),
  count("a3", "A3"),
  count("large", "A3 Colour"),
];

function num(v: number | null | undefined): number {
  return typeof v === "number" && isFinite(v) ? v : 0;
}

export default function PrinterDetailPage() {
  const { serial } = useParams();
  const router = useRouter();
  const serialStr = decodeURIComponent(serial as string);

  const [dimensions, setDimensions] = useState<PrinterDimensions | null>(null);
  const [mapping, setMapping] = useState<PrinterMapping | null>(null);
  const [feedback, setFeedback] = useState<PrinterFeedback>({
    condition: null, condition_notes: null,
    install_date: null, original_install_date: null, contract_end: null,
    technician_notes: null, last_visit: null, supplier: null,
  });
  const [history, setHistory] = useState<MeterReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [counter, setCounter] = useState<CounterKey>("total");

  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Role flag from the authenticated session. While the session loads,
  // isAdmin is false so admin-only cards stay hidden (least-privileged default).
  const { isAdmin } = useRole();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/equipment/printers/${encodeURIComponent(serialStr)}`);
      if (!res.ok) { router.push("/equipment"); return; }
      const data = await res.json();
      setDimensions(data.dimensions);
      setMapping(data.mapping);
      if (data.feedback) {
        setFeedback((f) => ({ ...f, ...data.feedback }));
      }
      setHistory(data.history ?? []);
      const mn = data.mapping?.model_name ?? data.dimensions?.model ?? "Unknown Model";
      const sn2 = data.mapping?.store ?? "";
      addRecentItem({
        type: "printer",
        id: serialStr,
        label: mn,
        sub: sn2,
        href: `/equipment/printers/${encodeURIComponent(serialStr)}`,
      });
    } finally {
      setLoading(false);
    }
  }, [serialStr, router]);

  useEffect(() => { load(); }, [load]);

  const setF = (k: keyof PrinterFeedback, v: string | null) => {
    setFeedback((f) => ({ ...f, [k]: v }));
    setDirty(true);
  };

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/equipment/printers/${encodeURIComponent(serialStr)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(feedback),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.feedback) setFeedback((f) => ({ ...f, ...data.feedback }));
      setDirty(false);
      setSavedFlash(true);
      clearTimeout(savedFlashTimer.current);
      savedFlashTimer.current = setTimeout(() => setSavedFlash(false), 3000);
      toast.success("Printer record saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }, [serialStr, feedback]);

  // Clear the "Saved" flash timer on unmount.
  useEffect(() => () => clearTimeout(savedFlashTimer.current), []);

  // ─── Volume: per-counter monthly deltas ─────────────────────────────────────
  // history is DESC (newest first). Delta of a reading = itself minus the next
  // (older) reading for the same counter. Negative deltas (meter resets /
  // machine swaps) are clamped to zero.
  const chartData = useMemo(() => {
    const rows: { label: string; date: string; value: number }[] = [];
    for (let i = 0; i < history.length - 1; i++) {
      const curr = history[i];
      const prev = history[i + 1];
      const c = num(curr[counter]);
      const p = num(prev[counter]);
      const delta = Math.max(0, c - p);
      rows.push({
        label: new Date(curr.report_date).toLocaleDateString("en-ZA", { month: "short" }),
        date: curr.report_date,
        value: delta,
      });
    }
    // Oldest → newest for a left-to-right chart, capped to 6 months.
    return rows.slice(0, 6).reverse();
  }, [history, counter]);

  const hasCounterData = useMemo(
    () => chartData.some((d) => d.value > 0) || history.some((r) => num(r[counter]) > 0),
    [chartData, history, counter],
  );

  const contractExpired =
    !!feedback.contract_end && new Date(feedback.contract_end) < new Date();

  useHotkeys([
    { key: "s", modifiers: ["cmd"], onTrigger: () => { if (dirty) save(); } },
    { key: "Escape", onTrigger: () => {
      const store = mapping?.store;
      if (store) router.push(`/equipment/stores/${encodeURIComponent(store)}`);
      else router.push("/equipment");
    }},
  ]);

  if (loading) return <Loading />;

  const storeName = mapping?.store ?? "";
  const modelName = mapping?.model_name ?? dimensions?.model ?? "Unknown Model";
  const counterLabel = COUNTER_TYPES.find((c) => c.key === counter)?.label ?? "";

  return (
    <EquipmentErrorBoundary>
      <Page
        title={modelName}
        titleExtra={
          saving ? (
            <Badge variant="secondary"><Spinner /> Saving</Badge>
          ) : savedFlash ? (
            <Badge status="success"><Check /> Saved</Badge>
          ) : dirty ? (
            <Badge status="warning">Unsaved changes</Badge>
          ) : null
        }
        crumbs={[
          { label: "Stores", href: "/equipment" },
          ...(storeName ? [{ label: storeName, href: `/equipment/stores/${encodeURIComponent(storeName)}` }] : []),
          { label: serialStr },
        ]}
        actions={
          <Button onClick={save} disabled={saving || !dirty}>
            {saving ? <Spinner /> : <Save />} Save
          </Button>
        }
      >
        <div className="flex w-full max-w-5xl flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{serialStr}</Badge>
            {mapping?.printer_type && <Badge variant="outline">{mapping.printer_type}</Badge>}
            {feedback.condition && <ConditionBadge condition={feedback.condition} />}
          </div>

          {/* Machine identity: read only, it comes from Xerox and BMS. */}
          <Panel caption="Machine identity">
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 lg:grid-cols-4">
              <ReadField label="Serial" value={dimensions?.serial_number ?? serialStr} />
              <ReadField label="Model" value={modelName} />
              <ReadField label="Store" value={storeName} />
              <ReadField label="Type" value={mapping?.printer_type ?? null} />
              <ReadField label="Manufacturer" value={dimensions?.manufacturer ?? null} />
              <ReadField label="Colour" value={dimensions?.color_capable ?? null} />
              <ReadField label="Duplex" value={dimensions?.duplex_capable ?? null} />
              <ReadField label="Last Seen" value={dimensions?.last_seen ? longDay(dimensions.last_seen) : null} />
            </div>
          </Panel>

          {/* Condition: editable by every user. */}
          <Panel caption="Condition" bodyClassName="flex flex-col gap-4">
            <Field label="Condition">
              <div className="flex flex-wrap items-center gap-2">
                <Segmented value={feedback.condition ?? ""} onValueChange={(v) => setF("condition", v)} options={CONDITION_OPTIONS} />
                {feedback.condition && (
                  <Button variant="ghost" size="sm" onClick={() => setF("condition", null)}>
                    <X /> Clear
                  </Button>
                )}
              </div>
            </Field>
            <Field label="Notes" htmlFor="printer-notes">
              <Textarea
                id="printer-notes"
                value={feedback.condition_notes ?? ""}
                onChange={(e) => setF("condition_notes", e.target.value || null)}
                placeholder="Faults, wear, paper feed issues, print quality"
                rows={4}
              />
            </Field>
          </Panel>

          {/* Contract and lifecycle: admin only. */}
          {isAdmin && (
            <Panel caption="Contract and lifecycle" bodyClassName="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Original Install Date" htmlFor="printer-original" hint="When the machine first entered service.">
                  <DayField id="printer-original" value={feedback.original_install_date ?? null} onChange={(v) => setF("original_install_date", v)} placeholder="First ever install" />
                </Field>
                <Field label="Latest Install Date" htmlFor="printer-install" hint="Install at its current store (may be recent).">
                  <DayField id="printer-install" value={feedback.install_date ?? null} onChange={(v) => setF("install_date", v)} placeholder="Install at current store" />
                </Field>
                <Field label="Age" hint="Calculated from the original install date.">
                  <p className="py-1.5 font-medium">{ageFromDate(feedback.original_install_date)}</p>
                </Field>
                <Field label="Contract End" htmlFor="printer-contract">
                  <DayField id="printer-contract" value={feedback.contract_end ?? null} onChange={(v) => setF("contract_end", v)} placeholder="Select date" />
                </Field>
                <Field label="Last Visit" htmlFor="printer-visit">
                  <DayField id="printer-visit" value={feedback.last_visit ?? null} onChange={(v) => setF("last_visit", v)} placeholder="Select date" />
                </Field>
                <Field label="Supplier">
                  <ModelSuggest source="suppliers" value={feedback.supplier ?? ""} onChange={(v) => setF("supplier", v || null)} placeholder="Where it was bought" />
                </Field>
              </div>
              {contractExpired && (
                <Alert variant="warning">
                  <AlertTitle>Contract expired</AlertTitle>
                  <AlertDescription>Ended {longDay(feedback.contract_end as string)}</AlertDescription>
                </Alert>
              )}
              <Field label="Technician Notes" htmlFor="printer-tech">
                <Textarea
                  id="printer-tech"
                  value={feedback.technician_notes ?? ""}
                  onChange={(e) => setF("technician_notes", e.target.value || null)}
                  placeholder="Work done, parts replaced, recurring issues"
                  rows={3}
                />
              </Field>
            </Panel>
          )}

          {history.length > 1 && (
            <Panel
              caption="Volume history"
              right={<Segmented value={counter} onValueChange={(v) => setCounter(v as CounterKey)} options={COUNTER_TYPES.map((ct) => ({ value: ct.key, label: ct.label }))} />}
              bodyClassName="flex flex-col gap-4"
            >
              <Bars
                labels={chartData.map((d) => d.label)}
                series={[{ label: "Prints", values: hasCounterData ? chartData.map((d) => d.value) : [] }]}
                format="count"
                height="md"
                empty={`No ${counterLabel} volume recorded`}
              />
              {/* The last 8 readings, every counter. */}
              <DataTable columns={READING_COLUMNS} rows={history.slice(0, 8)} rowKey={(_, i) => i} wide />
            </Panel>
          )}

          {/* Feedback and replacement requests (store and admin). */}
          <FeedbackPanel type="printer" refId={serialStr} />
        </div>
      </Page>
    </EquipmentErrorBoundary>
  );
}
