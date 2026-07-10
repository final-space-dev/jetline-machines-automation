export const EQUIPMENT_TYPES = [
  "Comb/Plastic Binder",
  "Corner Rounder",
  "Guillotine",
  "Heat Press",
  "Paper Drill/Punch",
  "Paper Folder",
  "Perfect Binder",
  "Pouch Laminator",
  "Roll/Wide-Format Laminator",
  "Scale",
  "Scorer/Creaser/Perforator",
  "Shrink Wrapper/Strapping",
  "Spiral/Coil Binder",
  "Stapler",
  "Stitcher/Saddle Stitcher",
  "Thermal/Heat Binder",
  "Trimmer",
  "Underpinner",
  "Wire Binder",
] as const;

export const ALL_XEROX_STORES = [
  "Alberton", "Bedfordview", "Benoni", "Blackheath", "Boksburg", "Brooklyn",
  "Bryanston", "Centurion", "Century City", "Constantia", "Die Bult", "Durban",
  "Fixtrade", "Fourways", "Fox Street", "Foxstreet", "Gardens", "George",
  "Greenpoint", "Hillcrest", "Hydepark", "Illovo", "Klerksdorp", "Kyalami",
  "Loftus", "Melrose", "Menlyn", "Midrand", "Mmabatho", "Modderfontein",
  "Montana", "Nelspruit", "Parktown", "Pietermaritzburg", "Polokwane",
  "Potchefstroom", "Randburg", "Rivonia", "Rosebank", "Rustenburg",
  "Sandown", "Stellenbosch", "Sunninghill", "Tygervalley", "Umhlanga",
  "Waterfront", "Wits", "Woodmead",
] as const;

export const EQUIPMENT_STATUSES = ["active", "inactive", "disposed", "transferred"] as const;
export type EquipmentStatus = typeof EQUIPMENT_STATUSES[number];

export type ConditionBucket = "good" | "fair" | "poor" | "unknown";

export function classifyCondition(c: string | null | undefined): ConditionBucket {
  if (!c || c === "—") return "unknown";
  const l = c.toLowerCase();
  if (
    l.includes("excellent") || l.includes("new") || l.includes("perfect") ||
    l.includes("good") || l.includes("neat") || l.includes("reliable") ||
    l.includes("working order") || l.includes("operational")
  ) return "good";
  if (
    l.includes("not working") || l.includes("broken") || l.includes("not operational") ||
    l.includes("not in use") || l.includes("poor") || l.includes("repair") ||
    l.includes("disposed") || l.includes("0%")
  ) return "poor";
  if (
    l.includes("fair") || l.includes("old") || l.includes("average") ||
    l.includes("okay") || l.includes("used") || l.includes("below avg") ||
    l.includes("time for replacement")
  ) return "fair";
  return "unknown";
}

export const CONDITION_CONFIG: Record<ConditionBucket, {
  label: string;
  color: string;
  bg: string;
  border: string;
}> = {
  good:    { label: "Good",    color: "var(--jl-green-700)", bg: "var(--jl-green-tint)",   border: "rgba(20,164,77,0.2)" },
  fair:    { label: "Fair",    color: "var(--jl-amber-700)", bg: "var(--jl-amber-tint)",   border: "rgba(229,138,0,0.2)" },
  poor:    { label: "Poor",    color: "var(--jl-red-700)",   bg: "var(--jl-red-tint)",     border: "rgba(230,18,31,0.2)" },
  unknown: { label: "Unknown", color: "var(--jl-ink-500)",   bg: "var(--jl-ink-50)",       border: "var(--jl-ink-200)" },
};

export const STATUS_CONFIG: Record<EquipmentStatus, { label: string; color: string; bg: string }> = {
  active:      { label: "Active",      color: "var(--jl-green-700)", bg: "var(--jl-green-tint)" },
  inactive:    { label: "Inactive",    color: "var(--jl-ink-500)",   bg: "var(--jl-ink-50)" },
  disposed:    { label: "Disposed",    color: "var(--jl-red-700)",   bg: "var(--jl-red-tint)" },
  transferred: { label: "Transferred", color: "var(--jl-blue-700)",  bg: "var(--jl-blue-tint)" },
};
