/**
 * JetlineFleet store group hierarchy.
 * Three-level company structure: Main Group -> Store Group -> Store,
 * plus the holding group (top-level owning entity).
 *
 * Source of truth for grouping the store grid (Phase 03) and seeding
 * `equipment.stores` identity rows (Phase 04). Match on `store` (case-insensitive).
 */

export interface StoreGroupEntry {
  mainGroup: string;
  storeGroup: string;
  store: string;
  holdingGroup: string;
}

export const STORE_GROUPS: StoreGroupEntry[] = [
  // JEH Stores -> Copper Moon
  { mainGroup: "JEH Stores", storeGroup: "Copper Moon", store: "Alberton", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "Copper Moon", store: "Bedfordview", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "Copper Moon", store: "Constantia", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "Copper Moon", store: "Durban", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "Copper Moon", store: "Gardens", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "Copper Moon", store: "Greenpoint", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "Copper Moon", store: "Hillcrest", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "Copper Moon", store: "Parktown", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "Copper Moon", store: "Pietermaritzburg", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "Copper Moon", store: "Rosebank", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "Copper Moon", store: "Waterfront", holdingGroup: "JEH Stores" },

  // JEH Stores -> JEH Stores
  { mainGroup: "JEH Stores", storeGroup: "JEH Stores", store: "Blackheath", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "JEH Stores", store: "Boksburg", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "JEH Stores", store: "Illovo", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "JEH Stores", store: "Melrose", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "JEH Stores", store: "Nelspruit", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "JEH Stores", store: "Sandown", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "JEH Stores", store: "Wits", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "JEH Stores", store: "Anglo", holdingGroup: "JEH Stores" },

  // JEH Stores -> Tshwane Stores
  { mainGroup: "JEH Stores", storeGroup: "Tshwane Stores", store: "Brooklyn", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "Tshwane Stores", store: "Centurion", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "Tshwane Stores", store: "Menlyn", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "Tshwane Stores", store: "Montana", holdingGroup: "JEH Stores" },

  // JEH Stores -> MIDRAND
  { mainGroup: "JEH Stores", storeGroup: "MIDRAND", store: "Kyalami", holdingGroup: "JEH Stores" },
  { mainGroup: "JEH Stores", storeGroup: "MIDRAND", store: "Midrand", holdingGroup: "JEH Stores" },

  // JEH Stores -> NW Stores
  { mainGroup: "JEH Stores", storeGroup: "NW Stores", store: "Polokwane", holdingGroup: "JEH Stores" },

  // JCP Group -> JCP Group
  { mainGroup: "JCP Group", storeGroup: "JCP Group", store: "Corporate Print", holdingGroup: "JCP Group" },
  { mainGroup: "JCP Group", storeGroup: "JCP Group", store: "Burlington", holdingGroup: "JCP Group" },
  { mainGroup: "JCP Group", storeGroup: "JCP Group", store: "Formatt", holdingGroup: "JCP Group" },
  { mainGroup: "JCP Group", storeGroup: "JCP Group", store: "Landk", holdingGroup: "JCP Group" },
  { mainGroup: "JCP Group", storeGroup: "JCP Group", store: "Marins", holdingGroup: "JCP Group" },
  { mainGroup: "JCP Group", storeGroup: "JCP Group", store: "Pocket Media", holdingGroup: "JCP Group" },
  { mainGroup: "JCP Group", storeGroup: "JCP Group", store: "Raptor", holdingGroup: "JCP Group" },
  { mainGroup: "JCP Group", storeGroup: "JCP Group", store: "System Print", holdingGroup: "JCP Group" },
  { mainGroup: "JCP Group", storeGroup: "JCP Group", store: "25 AMCPS", holdingGroup: "JCP Group" },
  { mainGroup: "JCP Group", storeGroup: "JCP Group", store: "Typo", holdingGroup: "JCP Group" },
  { mainGroup: "JCP Group", storeGroup: "JCP Group", store: "Printout", holdingGroup: "JCP Group" },
  { mainGroup: "JCP Group", storeGroup: "JCP Group", store: "First Labels", holdingGroup: "JCP Group" },

  // Franchisee Stores -> Saki Stores
  { mainGroup: "Franchisee Stores", storeGroup: "Saki Stores", store: "Stellenbosch", holdingGroup: "Franchisee Stores" },
  { mainGroup: "Franchisee Stores", storeGroup: "Saki Stores", store: "Tygervalley", holdingGroup: "Franchisee Stores" },

  // Franchisee Stores -> D&G Print
  { mainGroup: "Franchisee Stores", storeGroup: "D&G Print", store: "George", holdingGroup: "Franchisee Stores" },
  { mainGroup: "Franchisee Stores", storeGroup: "D&G Print", store: "Modderfontein", holdingGroup: "Franchisee Stores" },

  // Franchisee Stores -> Joseph Stores
  { mainGroup: "Franchisee Stores", storeGroup: "Joseph Stores", store: "Bryanston", holdingGroup: "Franchisee Stores" },
  { mainGroup: "Franchisee Stores", storeGroup: "Joseph Stores", store: "Fourways", holdingGroup: "Franchisee Stores" },

  // Franchisee Stores -> Lavery Print
  { mainGroup: "Franchisee Stores", storeGroup: "Lavery Print", store: "Randburg", holdingGroup: "Franchisee Stores" },
  { mainGroup: "Franchisee Stores", storeGroup: "Lavery Print", store: "Rivonia", holdingGroup: "Franchisee Stores" },
  { mainGroup: "Franchisee Stores", storeGroup: "Lavery Print", store: "Woodmead", holdingGroup: "Franchisee Stores" },

  // Franchisee Stores -> NW Stores
  { mainGroup: "Franchisee Stores", storeGroup: "NW Stores", store: "Klerksdorp", holdingGroup: "Franchisee Stores" },
  { mainGroup: "Franchisee Stores", storeGroup: "NW Stores", store: "Mmabatho", holdingGroup: "Franchisee Stores" },
  { mainGroup: "Franchisee Stores", storeGroup: "NW Stores", store: "Potchefstroom", holdingGroup: "Franchisee Stores" },
  { mainGroup: "Franchisee Stores", storeGroup: "NW Stores", store: "Rustenburg", holdingGroup: "Franchisee Stores" },
  { mainGroup: "Franchisee Stores", storeGroup: "NW Stores", store: "Vaalreefs", holdingGroup: "Franchisee Stores" },
  { mainGroup: "Franchisee Stores", storeGroup: "NW Stores", store: "Ballito", holdingGroup: "Franchisee Stores" },

  // Franchisee Stores -> Franchisee Stores
  { mainGroup: "Franchisee Stores", storeGroup: "Franchisee Stores", store: "Century City", holdingGroup: "Franchisee Stores" },
  { mainGroup: "Franchisee Stores", storeGroup: "Franchisee Stores", store: "Foxstreet", holdingGroup: "Franchisee Stores" },
  { mainGroup: "Franchisee Stores", storeGroup: "Franchisee Stores", store: "Hydepark", holdingGroup: "Franchisee Stores" },
  { mainGroup: "Franchisee Stores", storeGroup: "Franchisee Stores", store: "Sunninghill", holdingGroup: "Franchisee Stores" },
  { mainGroup: "Franchisee Stores", storeGroup: "Franchisee Stores", store: "Welkom", holdingGroup: "Franchisee Stores" },
  { mainGroup: "Franchisee Stores", storeGroup: "Franchisee Stores", store: "Benoni", holdingGroup: "Franchisee Stores" },

  // MASTERSKILL
  { mainGroup: "MASTERSKILL", storeGroup: "MASTERSKILL", store: "Masterskill", holdingGroup: "MASTERSKILL" },

  // FIXTRADE
  { mainGroup: "FIXTRADE", storeGroup: "FIXTRADE", store: "Fixtrade", holdingGroup: "FIXTRADE" },
];

const BY_STORE = new Map<string, StoreGroupEntry>(
  STORE_GROUPS.map((e) => [e.store.toLowerCase(), e])
);

/** Look up a store's group entry, case-insensitive. */
export function getStoreGroup(store: string): StoreGroupEntry | undefined {
  return BY_STORE.get(store.trim().toLowerCase());
}

/** Distinct main groups, in first-seen order. */
export function getMainGroups(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of STORE_GROUPS) {
    if (!seen.has(e.mainGroup)) {
      seen.add(e.mainGroup);
      out.push(e.mainGroup);
    }
  }
  return out;
}

/** Distinct store groups under a given main group, in first-seen order. */
export function getStoreGroupsByMain(main: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of STORE_GROUPS) {
    if (e.mainGroup === main && !seen.has(e.storeGroup)) {
      seen.add(e.storeGroup);
      out.push(e.storeGroup);
    }
  }
  return out;
}

/** All store names within a given store group, in listed order. */
export function getStoresByGroup(storeGroup: string): string[] {
  return STORE_GROUPS.filter((e) => e.storeGroup === storeGroup).map((e) => e.store);
}
