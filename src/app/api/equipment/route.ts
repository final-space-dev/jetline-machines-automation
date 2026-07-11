import { NextRequest, NextResponse } from "next/server";
import { bmsPool } from "@/lib/bms-pool";
import { withClient, badRequest, paginate, serverError, ensureItemColumns } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireUser, AuthError } from "@/lib/auth";

// ── Field normalizers (mirror /api/equipment/import) ─────────────────────────
function strOrNull(v: unknown): string | null {
  if (typeof v !== "string") return v == null ? null : String(v).trim() || null;
  return v.trim() || null;
}
// Accept YYYY-MM-DD (or anything Date can parse) and return YYYY-MM-DD, else null.
function dateOrNull(v: unknown): string | null {
  const s = strOrNull(v);
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
// Parse a currency-ish value to a number, else null (leaves NUMERIC column NULL).
function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export async function GET(req: NextRequest) {
  // Require a signed-in user; store staff are scoped to their own store.
  let store: string | null;
  try {
    const user = await requireUser();
    const url = req.nextUrl;
    store = user.role === "admin" ? url.searchParams.get("store") : user.store;
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const timer = routeTimer("GET /api/equipment");
  const url = req.nextUrl;
  const type = url.searchParams.get("type");
  const status = url.searchParams.get("status");
  const rawQ = url.searchParams.get("q");
  const q = rawQ ? rawQ.slice(0, 100) : null;
  const { page, limit, offset } = paginate(url, 200);

  return withClient(bmsPool, async (client) => {
    const conditions: string[] = ["deleted_at IS NULL"];
    const values: (string | number)[] = [];

    if (store)  { values.push(store);  conditions.push(`store = $${values.length}`); }
    if (type)   { values.push(type);   conditions.push(`machine_type = $${values.length}`); }
    if (status) { values.push(status); conditions.push(`status = $${values.length}`); }
    if (q) {
      values.push(`%${q}%`);
      const idx = values.length;
      conditions.push(
        `(store ILIKE $${idx} OR machine_type ILIKE $${idx} OR make_model ILIKE $${idx} OR serial ILIKE $${idx} OR condition ILIKE $${idx})`
      );
    }

    const where = `WHERE ${conditions.join(" AND ")}`;

    const [rowsResult, countResult, storesResult, typesResult] = await Promise.all([
      client.query(
        `SELECT * FROM equipment.items ${where} ORDER BY store, machine_type, id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
        [...values, limit, offset]
      ),
      client.query(`SELECT COUNT(*) AS total FROM equipment.items ${where}`, values),
      client.query(`SELECT store, COUNT(*) AS count FROM equipment.items WHERE deleted_at IS NULL GROUP BY store ORDER BY store`),
      client.query(`SELECT machine_type, COUNT(*) AS count FROM equipment.items WHERE deleted_at IS NULL GROUP BY machine_type ORDER BY machine_type`),
    ]);

    const total = parseInt(countResult.rows[0].total);
    timer.done({ total, page });
    return NextResponse.json({
      rows: rowsResult.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNext: page * limit < total,
      hasPrev: page > 1,
      stores: storesResult.rows,
      types: typesResult.rows,
    });
  }).catch((err) => { timer.error(err); return serverError(err, "GET /api/equipment"); });
}

export async function POST(req: NextRequest) {
  // Require a signed-in user; store staff may only create in their own store.
  let actor;
  try {
    actor = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const timer = routeTimer("POST /api/equipment");
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const {
    store, machine_type, make_model, serial, condition, located_at, status,
    purchase_date, supplier, purchase_price, warranty_expiry,
    last_serviced, next_service_due, service_provider, notes,
  } = body;
  if (!store?.trim() || !machine_type?.trim()) return badRequest("store and machine_type are required");
  if (actor.role !== "admin" && store.trim() !== actor.store) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return withClient(bmsPool, async (client) => {
    await ensureItemColumns(client);
    const result = await client.query(
      `INSERT INTO equipment.items
         (store, machine_type, make_model, serial, condition, located_at, status,
          purchase_date, supplier, purchase_price, warranty_expiry,
          last_serviced, next_service_due, service_provider, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [
        store.trim(), machine_type.trim(),
        strOrNull(make_model), strOrNull(serial),
        strOrNull(condition), strOrNull(located_at),
        status ?? "active",
        dateOrNull(purchase_date), strOrNull(supplier),
        numOrNull(purchase_price), dateOrNull(warranty_expiry),
        dateOrNull(last_serviced), dateOrNull(next_service_due),
        strOrNull(service_provider), strOrNull(notes),
      ]
    );
    timer.done({ store, machine_type });
    return NextResponse.json({ row: result.rows[0] }, { status: 201 });
  }).catch((err) => { timer.error(err); return serverError(err, "POST /api/equipment"); });
}
