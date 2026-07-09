import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { bmsPool } from "@/lib/bms-pool";
import { xeroxPool } from "@/lib/xerox-pool";
import { withClients, serverError, badRequest } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { requireUser, AuthError, type SessionUser } from "@/lib/auth";
import {
  scoreStoreCompleteness,
  type CompletenessResult,
} from "@/lib/completeness";

/**
 * Phase 19 — Per-store completeness score.
 *
 * Scoring (per equipment item, out of 100):
 *   machine_type      10  (always present if the item exists)
 *   make_model        15
 *   serial            15
 *   condition set     20
 *   status non-default 5  (anything other than "active")
 *   purchase_date     10  *optional column — guarded
 *   warranty_expiry    5  *optional column — guarded
 *   last_serviced     10  *optional column — guarded
 *   next_service_due  10  *optional column — guarded
 *
 * equipmentScore = avg item score.
 * printerScore   = % of printers with condition + age + replace_flag all set.
 * overallScore   = round(0.7 * equipmentScore + 0.3 * printerScore).
 *
 * Optional item columns and machine_feedback columns are probed via
 * information_schema so the route never errors on a schema that predates them.
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  let user: SessionUser;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const { store } = await params;
  const storeName = decodeURIComponent(store);
  if (!storeName.trim()) return badRequest("store is required");
  if (user.role !== "admin" && storeName !== user.store) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const timer = routeTimer(`GET /api/stores/${storeName}/completeness`);

  return withClients([bmsPool, xeroxPool], async (eqClient: PoolClient, xClient: PoolClient) => {
    const result: CompletenessResult = await scoreStoreCompleteness(eqClient, xClient, storeName);
    timer.done({
      store: storeName,
      overallScore: result.overallScore,
      items: result.itemBreakdown.length,
      printers: result.printerBreakdown.length,
    });
    return NextResponse.json(result);
  }).catch((err) => { timer.error(err); return serverError(err, `GET /api/stores/${storeName}/completeness`); });
}
