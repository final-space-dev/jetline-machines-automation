import { NextRequest, NextResponse } from "next/server";
import { xeroxPool } from "@/lib/xerox-pool";
import { withClient, badRequest, serverError, ensureFeedbackColumns } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireUser, AuthError, type SessionUser } from "@/lib/auth";

const ALLOWED = ["condition_notes", "age", "install_date", "contract_end", "technician_notes", "last_visit"];

export async function PATCH(req: NextRequest) {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const timer = routeTimer("PATCH /api/equipment/feedback");
  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const { serial_number, ...fields } = body;
  if (!serial_number) return badRequest("serial_number required");

  const sn = String(serial_number).toUpperCase().trim();
  const updates: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (ALLOWED.includes(k)) updates[k] = (v as string) || null;
  }
  if (Object.keys(updates).length === 0) return badRequest("No valid fields");

  return withClient(xeroxPool, async (client) => {
    await ensureFeedbackColumns(client);

    // Enforce store ownership for store_staff. Fail closed: deny if the printer's
    // store cannot be resolved to the caller's own store.
    if (user.role !== "admin") {
      const storeRes = await client.query(
        `SELECT store FROM xerox.printer_store_map WHERE UPPER(TRIM(serial_number)) = $1 LIMIT 1`,
        [sn]
      );
      const store = storeRes.rows[0]?.store ?? null;
      if (!store || store !== user.store) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const existing = await client.query(
      `SELECT serial_number FROM xerox.machine_feedback WHERE UPPER(TRIM(serial_number)) = $1`, [sn]
    );

    let row;
    if (existing.rows.length === 0) {
      const cols = ["serial_number", ...Object.keys(updates)];
      const placeholders = cols.map((_, i) => `$${i + 1}`);
      const result = await client.query(
        `INSERT INTO xerox.machine_feedback (${cols.join(", ")}) VALUES (${placeholders.join(", ")}) RETURNING *`,
        [sn, ...Object.values(updates)]
      );
      row = result.rows[0];
    } else {
      const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 2}`);
      const result = await client.query(
        `UPDATE xerox.machine_feedback SET ${setClauses.join(", ")} WHERE UPPER(TRIM(serial_number)) = $1 RETURNING *`,
        [sn, ...Object.values(updates)]
      );
      row = result.rows[0];
    }

    timer.done({ sn, fields: Object.keys(updates) });
    return NextResponse.json({ row });
  }).catch((err) => { timer.error(err); return serverError(err, "PATCH /api/equipment/feedback"); });
}
