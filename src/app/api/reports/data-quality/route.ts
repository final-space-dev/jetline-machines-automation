import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { bmsPool } from "@/lib/bms-pool";
import { xeroxPool } from "@/lib/xerox-pool";
import { withClients, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireAdmin, AuthError } from "@/lib/auth";
import { getStoreGroup } from "@/lib/store-groups";
import { scoreItem, scorePrinter } from "@/lib/completeness";

/**
 * Phase 19 — Admin data-quality report across all stores.
 *
 * Reuses the exact `scoreItem` / `scorePrinter` functions from @/lib/completeness
 * so every store's overallScore matches its per-store /completeness endpoint.
 * Rows are fetched in bulk (all items + all printer feedback in two queries) then
 * grouped by store in memory — no per-store round-trips.
 *
 * Sorted by overallScore ascending (worst first) for accountability.
 * `?format=csv` streams a text/csv attachment for the management report.
 */

const OPTIONAL_ITEM_COLUMNS = [
  "purchase_date",
  "warranty_expiry",
  "last_serviced",
  "next_service_due",
] as const;

const OPTIONAL_FEEDBACK_COLUMNS = ["condition_notes", "age", "replace_flag"] as const;

interface ItemRow {
  id: number;
  store: string | null;
  machine_type: string | null;
  make_model: string | null;
  serial: string | null;
  condition: string | null;
  status: string | null;
  [key: string]: unknown;
}

interface FeedbackRow {
  store: string | null;
  serial_number: string;
  [key: string]: unknown;
}

interface StoreQuality {
  store: string;
  group: string | null;
  overallScore: number;
  itemsCount: number;
  itemsNoSerial: number;
  itemsNoServiceDate: number;
  printersNoCondition: number;
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

function escapeCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (s.includes(",") || s.includes('"') || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const format = req.nextUrl.searchParams.get("format");
  const timer = routeTimer("GET /api/reports/data-quality");

  return withClients([bmsPool, xeroxPool], async (eqClient: PoolClient, xClient: PoolClient) => {
    const [itemOptCols, feedbackCols] = await Promise.all([
      existingColumns(eqClient, "equipment", "items", OPTIONAL_ITEM_COLUMNS),
      existingColumns(xClient, "xerox", "machine_feedback", OPTIONAL_FEEDBACK_COLUMNS),
    ]);
    const selectOptional = OPTIONAL_ITEM_COLUMNS.filter((c) => itemOptCols.has(c));
    const feedbackSelect = OPTIONAL_FEEDBACK_COLUMNS.filter((c) => feedbackCols.has(c));

    const [itemsRes, printersRes] = await Promise.all([
      eqClient.query<ItemRow>(
        `SELECT id, store, machine_type, make_model, serial, condition, status${
          selectOptional.length ? ", " + selectOptional.join(", ") : ""
        }
         FROM equipment.items WHERE store IS NOT NULL ORDER BY store, id`
      ),
      xClient.query<FeedbackRow>(
        `SELECT psm.store, psm.serial_number${
          feedbackSelect.length ? ", " + feedbackSelect.map((c) => `mf.${c}`).join(", ") : ""
        }
         FROM xerox.printer_store_map psm
         JOIN xerox.printer_dimensions pd ON pd.serial_number = psm.serial_number
         LEFT JOIN xerox.machine_feedback mf
           ON UPPER(TRIM(mf.serial_number)) = UPPER(TRIM(psm.serial_number))
         WHERE psm.store IS NOT NULL AND psm.reporting_enabled = true AND pd.manufacturer = 'Xerox'
         ORDER BY psm.store, psm.serial_number`
      ),
    ]);

    // Group rows by store.
    const itemsByStore = new Map<string, ItemRow[]>();
    for (const row of itemsRes.rows) {
      if (!row.store) continue;
      const arr = itemsByStore.get(row.store) ?? [];
      arr.push(row);
      itemsByStore.set(row.store, arr);
    }
    const printersByStore = new Map<string, FeedbackRow[]>();
    for (const row of printersRes.rows) {
      if (!row.store) continue;
      const arr = printersByStore.get(row.store) ?? [];
      arr.push(row);
      printersByStore.set(row.store, arr);
    }

    const storeNames = new Set<string>([...itemsByStore.keys(), ...printersByStore.keys()]);

    const rows: StoreQuality[] = Array.from(storeNames).map((store) => {
      const items = itemsByStore.get(store) ?? [];
      const printers = printersByStore.get(store) ?? [];

      const itemScores = items.map((r) => scoreItem(r, itemOptCols));
      const printerScores = printers.map((r) => scorePrinter(r, feedbackCols));

      const equipmentScore =
        itemScores.length > 0
          ? Math.round(itemScores.reduce((s, i) => s + i.score, 0) / itemScores.length)
          : 0;
      const printerScore =
        printerScores.length > 0
          ? Math.round(
              (printerScores.filter((p) => p.score === 100).length / printerScores.length) * 100
            )
          : 0;
      const overallScore = Math.round(0.7 * equipmentScore + 0.3 * printerScore);

      const itemsNoSerial = itemScores.filter((i) => i.missing.includes("serial")).length;
      const itemsNoServiceDate = itemScores.filter(
        (i) => i.missing.includes("last_serviced") || i.missing.includes("next_service_due")
      ).length;
      const printersNoCondition = printerScores.filter((p) =>
        p.missing.includes("condition")
      ).length;

      return {
        store,
        group: getStoreGroup(store)?.storeGroup ?? null,
        overallScore,
        itemsCount: items.length,
        itemsNoSerial,
        itemsNoServiceDate,
        printersNoCondition,
      };
    });

    rows.sort((a, b) => a.overallScore - b.overallScore);

    if (format === "csv") {
      const HEADERS = [
        "Store",
        "Group",
        "Overall Score",
        "Items Count",
        "Items No Serial",
        "Items No Service Date",
        "Printers No Condition",
      ];
      const lines: string[] = [HEADERS.join(",")];
      for (const r of rows) {
        lines.push(
          [
            r.store,
            r.group,
            r.overallScore,
            r.itemsCount,
            r.itemsNoSerial,
            r.itemsNoServiceDate,
            r.printersNoCondition,
          ]
            .map(escapeCell)
            .join(",")
        );
      }
      const csv = lines.join("\n");
      const filename = `jetline-data-quality_${new Date().toISOString().slice(0, 10)}.csv`;
      timer.done({ stores: rows.length, format: "csv" });
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    timer.done({ stores: rows.length });
    return NextResponse.json({ stores: rows });
  }).catch((err) => { timer.error(err); return serverError(err, "GET /api/reports/data-quality"); });
}
