const STORAGE_KEY = "jetline-feature-toggles";

export interface FeatureToggles {
  // Other Tools — all toggleable for presentation mode
  machines: boolean;
  machinesAudit: boolean;
  performance: boolean;
  reports: boolean;
  existenceRecon: boolean;
  syncStatus: boolean;
  // Legacy toggles
  dashboard: boolean;
  contracts: boolean;
  liftPlanner: boolean;
}

const DEFAULTS: FeatureToggles = {
  machines: true,
  machinesAudit: true,
  performance: true,
  reports: true,
  existenceRecon: true,
  syncStatus: true,
  dashboard: false,
  contracts: false,
  liftPlanner: false,
};

export function getFeatureToggles(): FeatureToggles {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(stored) };
  } catch {
    return DEFAULTS;
  }
}

export function setFeatureToggles(toggles: FeatureToggles): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toggles));
}
