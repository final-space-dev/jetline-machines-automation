import { NextRequest, NextResponse } from "next/server";
import { bmsPool } from "@/lib/bms-pool";
import { withClient, serverError } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireAdmin, AuthError } from "@/lib/auth";

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
  // Bulk CSV export of equipment data is admin-only.
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const timer = routeTimer("GET /api/equipment/export");
  const url = req.nextUrl;
  const store = url.searchParams.get("store");
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");

  return withClient(bmsPool, async (client) => {
    const conditions: string[] = [];
    const values: string[] = [];
    if (store)  { values.push(store);  conditions.push(`store = $${values.length}`); }
    if (status) { values.push(status); conditions.push(`status = $${values.length}`); }
    if (type)   { values.push(type);   conditions.push(`machine_type = $${values.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    const result = await client.query(
      `SELECT
         id, store, machine_type, make_model, serial, status, condition,
         located_at, supplier, purchase_date, purchase_price, warranty_expiry,
         last_serviced, next_service_due, service_provider, notes, updated_at
       FROM equipment.items ${where}
       ORDER BY store, machine_type, id`,
      values
    );

    const HEADERS = [
      "ID", "Store", "Type", "Make/Model", "Serial", "Status", "Condition",
      "Located At", "Supplier", "Purchase Date", "Purchase Price (ZAR)",
      "Warranty Expiry", "Last Serviced", "Next Service Due",
      "Service Provider", "Notes", "Last Updated",
    ];
    const FIELDS: (keyof typeof result.rows[0])[] = [
      "id", "store", "machine_type", "make_model", "serial", "status", "condition",
      "located_at", "supplier", "purchase_date", "purchase_price", "warranty_expiry",
      "last_serviced", "next_service_due", "service_provider", "notes", "updated_at",
    ];

    const lines: string[] = [HEADERS.join(",")];
    for (const row of result.rows) {
      lines.push(FIELDS.map((f) => escapeCell(row[f])).join(","));
    }

    const csv = lines.join("\n");
    const filename = [
      "jetline-equipment",
      store ? store.replace(/\s+/g, "-").toLowerCase() : "all-stores",
      new Date().toISOString().slice(0, 10),
    ].join("_") + ".csv";

    timer.done({ rows: result.rows.length, store: store ?? "all" });
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }).catch((err) => { timer.error(err); return serverError(err, "GET /api/equipment/export"); });
}
