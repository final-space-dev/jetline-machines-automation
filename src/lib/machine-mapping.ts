/**
 * Machine mapping: what a Xerox machine is, and the quick filters over the
 * list. Pure, so the counts on screen can be tested.
 */

export interface XeroxMachine {
  printer_id: number;
  serial_number: string;
  model: string;
  model_name: string | null;
  store: string | null;
  company_group: string | null;
  printer_type: string | null;
  reporting_enabled: boolean | null;
  latest_reading_date: string | null;
  last_seen: string | null;
  bms_found: boolean;
  bms_active: boolean | null;
  bms_company: string | null;
  xerox_status: "Present" | "Missing";
}

export type QuickFilter =
  | "all"
  | "unmapped"           // no store AND no group
  | "mapped"             // has store or group
  | "no_bms"             // not found in BMS at all
  | "bms_inactive"       // in BMS but inactive
  | "bms_mismatch"       // mapped to a store but BMS company name doesn't match
  | "off"                // reporting disabled
  | "no_readings"        // never sent a reading
  | "xerox_missing";     // not on latest Xerox file

// BMS company name contains-match heuristic
export function hasBmsMismatch(m: XeroxMachine): boolean {
  if (!m.bms_found || !m.store || !m.bms_company) return false;
  const store = m.store.toLowerCase();
  const bmsCompany = m.bms_company.toLowerCase();
  return !bmsCompany.includes(store) && !store.includes(bmsCompany.split(" ").pop() ?? "");
}

// ─── Filter config ────────────────────────────────────────────────────────────

export const FILTER_LABELS: Record<QuickFilter, string> = {
  all:           "All",
  unmapped:      "Unmapped",
  mapped:        "Mapped",
  no_bms:        "Not in BMS",
  bms_inactive:  "BMS inactive",
  bms_mismatch:  "BMS mismatch",
  off:           "Switched off",
  no_readings:   "No readings",
  xerox_missing: "Missing from Xerox",
};

export const WARNING_FILTERS: QuickFilter[] = ["unmapped", "no_bms", "bms_inactive", "bms_mismatch", "xerox_missing"];

export function matchesFilter(m: XeroxMachine, f: QuickFilter): boolean {
  switch (f) {
    case "all":           return true;
    case "unmapped":      return !m.store && !m.company_group;
    case "mapped":        return !!(m.store || m.company_group);
    case "no_bms":        return !m.bms_found;
    case "bms_inactive":  return m.bms_found && m.bms_active === false;
    case "bms_mismatch":  return hasBmsMismatch(m);
    case "off":           return m.reporting_enabled === false;
    case "no_readings":   return !m.latest_reading_date;
    case "xerox_missing": return m.xerox_status === "Missing";
  }
}

/**
 * How many machines need attention: each machine once, however many of the
 * warning filters it falls under. (Adding the filters' counts together
 * counted a machine once per filter and could exceed the total.)
 */
export function needingAttention(machines: XeroxMachine[]): number {
  return machines.filter((m) => WARNING_FILTERS.some((f) => matchesFilter(m, f))).length;
}
