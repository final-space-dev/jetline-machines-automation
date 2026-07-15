import { NextRequest, NextResponse } from "next/server";
import { xeroxPool } from "@/lib/xerox-pool";
import { withClient, badRequest, serverError, ensureFeedbackColumns } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireAdmin, AuthError } from "@/lib/auth";
import { z } from "zod";

/**
 * Bulk-set the Original Install Date per Xerox serial (admin only). This is the
 * date a machine FIRST entered service, from JETLINE_AGED — the fixed source of
 * truth for Age. It is stored on xerox.machine_feedback.original_install_date,
 * upserted by serial; the row is created if the machine has no feedback yet.
 *
 * POST body: { rows: [{ serial, original_install_date }] }
 *   original_install_date: YYYY-MM-DD (or anything Date can parse)
 */

const Schema = z.object({
  rows: z.array(z.object({
    serial: z.string().trim().min(1),
    original_install_date: z.string().trim().min(1),
  })).min(1).max(5000),
});

function normDate(s: string): string | null {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function POST(req: NextRequest) {
  try { await requireAdmin(); }
  catch (e) { if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status }); throw e; }

  const raw = await req.json().catch(() => null);
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "invalid body");
  const { rows } = parsed.data;

  const timer = routeTimer("POST /api/setup/original-install-dates");
  return withClient(xeroxPool, async (client) => {
    await ensureFeedbackColumns(client);

    let updated = 0, skipped = 0;
    for (const r of rows) {
      const serial = r.serial.trim();
      const date = normDate(r.original_install_date);
      if (!serial || !date) { skipped++; continue; }
      // Upsert onto machine_feedback by serial (create the row if absent).
      await client.query(
        `INSERT INTO xerox.machine_feedback (serial_number, original_install_date)
         VALUES ($1, $2::date)
         ON CONFLICT (serial_number)
           DO UPDATE SET original_install_date = EXCLUDED.original_install_date, updated_at = NOW()`,
        [serial, date],
      );
      updated++;
    }

    timer.done({ updated, skipped });
    return NextResponse.json({ updated, skipped });
  }).catch((err) => { timer.error(err); return serverError(err, "POST /api/setup/original-install-dates"); });
}
