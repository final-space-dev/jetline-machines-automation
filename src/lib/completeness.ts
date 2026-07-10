/**
 * Phase 19 — Data quality / completeness scoring.
 *
 * Shared by:
 *   - GET /api/stores/[store]/completeness   (per-store detail)
 *   - GET /api/reports/data-quality          (all-stores admin report)
 *
 * so the numbers are guaranteed identical across both endpoints.
 *
 * Equipment items live in `equipment.items` (bmsPool). Printer feedback lives in
 * `xerox.machine_feedback` (xeroxPool), joined to `xerox.printer_store_map` for
 * store scoping. Optional columns are probed via information_schema so a schema
 * that predates the newer columns (purchase_date, warranty_expiry, last_serviced,
 * next_service_due on items; condition_notes/age/replace_flag on machine_feedback)
 * scores those points as 0 instead of throwing.
 */

import type { PoolClient } from "pg";

export interface ItemBreakdown {
  id: number;
  type: string;
  score: number;
  missing: string[];
}

export interface PrinterBreakdown {
  serial: string;
  score: number;
  missing: string[];
}

export interface CompletenessResult {
  store: string;
  equipmentScore: number;
  printerScore: number;
  overallScore: number;
  itemBreakdown: ItemBreakdown[];
  printerBreakdown: PrinterBreakdown[];
}

/** Per-item point weights. Sum = 100. */
const ITEM_WEIGHTS = {
  machine_type: 10,
  make_model: 15,
  serial: 15,
  condition: 20,
  status: 5,
  purchase_date: 10,
  warranty_expiry: 5,
  last_serviced: 10,
  next_service_due: 10,
} as const;

const OPTIONAL_ITEM_COLUMNS = [
  "purchase_date",
  "warranty_expiry",
  "last_serviced",
  "next_service_due",
] as const;

const OPTIONAL_FEEDBACK_COLUMNS = ["condition_notes", "age", "replace_flag"] as const;

function filled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  return true;
}

async function existingColumns(
  client: PoolClient,
  schema: string,
  table: string,
  candidates: readonly string[]
): Promise<Set<string>> {
  const res = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 AND column_name = ANY($3)`,
    [schema, table, candidates as unknown as string[]]
  );
  return new Set(res.rows.map((r) => r.column_name));
}

export interface ItemRow {
  id: number;
  machine_type: string | null;
  make_model: string | null;
  serial: string | null;
  condition: string | null;
  status: string | null;
  [key: string]: unknown;
}

export interface FeedbackRow {
  serial_number: string;
  [key: string]: unknown;
}

/** Score a single equipment item. `optionalCols` = which optional columns exist. */
export function scoreItem(row: ItemRow, optionalCols: Set<string>): ItemBreakdown {
  let score = 0;
  const missing: string[] = [];

  const add = (key: keyof typeof ITEM_WEIGHTS, present: boolean) => {
    if (present) score += ITEM_WEIGHTS[key];
    else missing.push(key);
  };

  add("machine_type", filled(row.machine_type));
  add("make_model", filled(row.make_model));
  add("serial", filled(row.serial));
  add("condition", filled(row.condition));
  // status counts only when set to something other than the default "active".
  add("status", filled(row.status) && row.status!.trim().toLowerCase() !== "active");

  for (const col of OPTIONAL_ITEM_COLUMNS) {
    if (optionalCols.has(col)) {
      add(col, filled(row[col]));
    } else {
      // Column doesn't exist in this schema → those points are unattainable,
      // so the field is reported as missing and scores 0.
      missing.push(col);
    }
  }

  return { id: row.id, type: row.machine_type ?? "Unknown", score, missing };
}

/** Score a single printer's feedback completeness (condition + age + replace_flag). */
export function scorePrinter(row: FeedbackRow, feedbackCols: Set<string>): PrinterBreakdown {
  const checks: Array<{ label: string; present: boolean }> = [
    { label: "condition", present: feedbackCols.has("condition_notes") && filled(row.condition_notes) },
    { label: "age", present: feedbackCols.has("age") && filled(row.age) },
    { label: "replace_flag", present: feedbackCols.has("replace_flag") && filled(row.replace_flag) },
  ];
  const setCount = checks.filter((c) => c.present).length;
  const score = Math.round((setCount / checks.length) * 100);
  const missing = checks.filter((c) => !c.present).map((c) => c.label);
  return { serial: row.serial_number, score, missing };
}

/**
 * Full per-store completeness computation.
 * eqClient → bmsPool (equipment.items), xClient → xeroxPool (xerox schema).
 */
export async function scoreStoreCompleteness(
  eqClient: PoolClient,
  xClient: PoolClient,
  store: string
): Promise<CompletenessResult> {
  const [itemOptCols, feedbackCols] = await Promise.all([
    existingColumns(eqClient, "equipment", "items", OPTIONAL_ITEM_COLUMNS),
    existingColumns(xClient, "xerox", "machine_feedback", OPTIONAL_FEEDBACK_COLUMNS),
  ]);

  const selectOptional = OPTIONAL_ITEM_COLUMNS.filter((c) => itemOptCols.has(c));
  const feedbackSelect = OPTIONAL_FEEDBACK_COLUMNS.filter((c) => feedbackCols.has(c));

  const [itemsRes, printersRes] = await Promise.all([
    eqClient.query<ItemRow>(
      `SELECT id, machine_type, make_model, serial, condition, status${
        selectOptional.length ? ", " + selectOptional.join(", ") : ""
      }
       FROM equipment.items WHERE store = $1 ORDER BY id`,
      [store]
    ),
    xClient.query<FeedbackRow>(
      `SELECT psm.serial_number${
        feedbackSelect.length ? ", " + feedbackSelect.map((c) => `mf.${c}`).join(", ") : ""
      }
       FROM xerox.printer_store_map psm
       JOIN xerox.printer_dimensions pd ON pd.serial_number = psm.serial_number
       LEFT JOIN xerox.machine_feedback mf
         ON UPPER(TRIM(mf.serial_number)) = UPPER(TRIM(psm.serial_number))
       WHERE psm.store = $1 AND psm.reporting_enabled = true AND pd.manufacturer = 'Xerox'
       ORDER BY psm.serial_number`,
      [store]
    ),
  ]);

  const itemBreakdown = itemsRes.rows.map((r) => scoreItem(r, itemOptCols));
  const printerBreakdown = printersRes.rows.map((r) => scorePrinter(r, feedbackCols));

  const equipmentScore =
    itemBreakdown.length > 0
      ? Math.round(itemBreakdown.reduce((s, i) => s + i.score, 0) / itemBreakdown.length)
      : 0;

  // % of printers with condition + age + replace_flag all set (score === 100).
  const printerScore =
    printerBreakdown.length > 0
      ? Math.round(
          (printerBreakdown.filter((p) => p.score === 100).length / printerBreakdown.length) * 100
        )
      : 0;

  const overallScore = Math.round(0.7 * equipmentScore + 0.3 * printerScore);

  return { store, equipmentScore, printerScore, overallScore, itemBreakdown, printerBreakdown };
}
