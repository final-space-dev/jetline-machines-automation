import { NextRequest, NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { bmsPool } from "@/lib/bms-pool";
import { xeroxPool } from "@/lib/xerox-pool";
import { withClient, withClients, serverError, badRequest } from "@/lib/api-utils";
import { routeTimer } from "@/lib/logger";
import { getStoreGroup, STORE_GROUPS } from "@/lib/store-groups";
import { requireUser, AuthError, type SessionUser } from "@/lib/auth";

interface StoreRow {
  name: string;
  main_group: string | null;
  store_group: string | null;
  holding_group: string | null;
  address: string | null;
  phone: string | null;
  manager_name: string | null;
  manager_email: string | null;
}

interface Identity {
  name: string;
  mainGroup: string | null;
  storeGroup: string | null;
  holdingGroup: string | null;
  address: string | null;
  phone: string | null;
  managerName: string | null;
  managerEmail: string | null;
}

function mapIdentity(row: StoreRow): Identity {
  return {
    name: row.name,
    mainGroup: row.main_group,
    storeGroup: row.store_group,
    holdingGroup: row.holding_group,
    address: row.address,
    phone: row.phone,
    managerName: row.manager_name,
    managerEmail: row.manager_email,
  };
}

/** Synthesize an identity from the static group map when no DB row exists. */
function synthIdentity(storeName: string): Identity {
  const g = getStoreGroup(storeName);
  return {
    name: storeName,
    mainGroup: g?.mainGroup ?? null,
    storeGroup: g?.storeGroup ?? null,
    holdingGroup: g?.holdingGroup ?? null,
    address: null,
    phone: null,
    managerName: null,
    managerEmail: null,
  };
}

/**
 * Create-if-missing + seed group columns from STORE_GROUPS.
 * Idempotent and cheap. Never clobbers user-entered contact fields
 * (address/phone/manager_*) — only refreshes the group columns.
 */
async function ensureStoresTable(client: PoolClient): Promise<void> {
  await client.query(`CREATE SCHEMA IF NOT EXISTS equipment`);
  await client.query(
    `CREATE TABLE IF NOT EXISTS equipment.stores (
       name TEXT PRIMARY KEY,
       main_group TEXT,
       store_group TEXT,
       holding_group TEXT,
       address TEXT,
       phone TEXT,
       manager_name TEXT,
       manager_email TEXT,
       updated_at TIMESTAMPTZ DEFAULT NOW()
     )`
  );

  if (STORE_GROUPS.length === 0) return;
  const values: string[] = [];
  const params: (string | null)[] = [];
  let i = 1;
  for (const g of STORE_GROUPS) {
    values.push(`($${i}, $${i + 1}, $${i + 2}, $${i + 3})`);
    params.push(g.store, g.mainGroup, g.storeGroup, g.holdingGroup);
    i += 4;
  }
  await client.query(
    `INSERT INTO equipment.stores (name, main_group, store_group, holding_group)
     VALUES ${values.join(", ")}
     ON CONFLICT (name) DO UPDATE SET
       main_group = EXCLUDED.main_group,
       store_group = EXCLUDED.store_group,
       holding_group = EXCLUDED.holding_group`,
    params
  );
}

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
  // Store staff may only read their own store.
  if (user.role !== "admin" && storeName !== user.store) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const timer = routeTimer(`GET /api/stores/${storeName}`);

  return withClients([bmsPool, xeroxPool], async (eqClient, xClient) => {
    await ensureStoresTable(eqClient);

    const [identityResult, eqResult, machinesResult] = await Promise.all([
      eqClient.query<StoreRow>(
        `SELECT name, main_group, store_group, holding_group,
                address, phone, manager_name, manager_email
         FROM equipment.stores WHERE name = $1`,
        [storeName]
      ),
      eqClient.query(
        `SELECT * FROM equipment.items WHERE store = $1 ORDER BY machine_type, id`,
        [storeName]
      ),
      xClient.query(
        `SELECT pd.serial_number, COALESCE(psm.model_name, pd.model) AS model_name,
                psm.printer_type, pd.last_seen::text,
                mf.condition_notes, mf.age
         FROM xerox.printer_dimensions pd
         JOIN xerox.printer_store_map psm ON psm.serial_number = pd.serial_number
         LEFT JOIN xerox.machine_feedback mf ON UPPER(TRIM(mf.serial_number)) = UPPER(TRIM(pd.serial_number))
         WHERE psm.store = $1
           AND pd.manufacturer = 'Xerox'
           AND psm.reporting_enabled = true
         ORDER BY pd.serial_number`,
        [storeName]
      ),
    ]);

    const identity = identityResult.rows.length > 0
      ? mapIdentity(identityResult.rows[0])
      : synthIdentity(storeName);

    timer.done({ store: storeName, equipment: eqResult.rows.length, machines: machinesResult.rows.length });
    return NextResponse.json({
      identity,
      equipment: eqResult.rows,
      machines: machinesResult.rows,
    });
  }).catch((err) => { timer.error(err); return serverError(err, `GET /api/stores/${storeName}`); });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ store: string }> }
) {
  // Store contact details are editable by admins AND by staff on their OWN store
  // (the store keeps its own contact info current). Only these contact fields are
  // writable here — group/connection assignment lives in Config (admin-only).
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
  const timer = routeTimer(`PATCH /api/stores/${storeName}`);

  const body = await req.json().catch(() => null);
  if (!body) return badRequest("Invalid JSON body");

  const address = typeof body.address === "string" ? body.address.trim() || null : null;
  const phone = typeof body.phone === "string" ? body.phone.trim() || null : null;
  const managerName = typeof body.managerName === "string" ? body.managerName.trim() || null : null;
  const managerEmail = typeof body.managerEmail === "string" ? body.managerEmail.trim() || null : null;

  return withClient(bmsPool, async (client) => {
    await ensureStoresTable(client);

    const g = getStoreGroup(storeName);
    const result = await client.query<StoreRow>(
      `INSERT INTO equipment.stores
         (name, main_group, store_group, holding_group, address, phone, manager_name, manager_email, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       ON CONFLICT (name) DO UPDATE SET
         address = EXCLUDED.address,
         phone = EXCLUDED.phone,
         manager_name = EXCLUDED.manager_name,
         manager_email = EXCLUDED.manager_email,
         updated_at = NOW()
       RETURNING name, main_group, store_group, holding_group,
                 address, phone, manager_name, manager_email`,
      [
        storeName,
        g?.mainGroup ?? null,
        g?.storeGroup ?? null,
        g?.holdingGroup ?? null,
        address, phone, managerName, managerEmail,
      ]
    );

    timer.done({ store: storeName });
    return NextResponse.json({ identity: mapIdentity(result.rows[0]) });
  }).catch((err) => { timer.error(err); return serverError(err, `PATCH /api/stores/${storeName}`); });
}
