export type ViewMode = "dashboard" | "machines" | "warroom" | "settings" | "analytics";

export interface MachineWithRelations {
  id: string;
  serialNumber: string;
  bmsMachinesId: number | null;
  bmsMachineNo: string | null;
  companyId: string;
  categoryId: string | null;
  modelId: string | null;
  machineName: string | null;
  makeName: string | null;
  modelName: string | null;
  status: "ACTIVE" | "INACTIVE" | "MAINTENANCE" | "DECOMMISSIONED";
  bmsStatus: number | null;
  action: "NONE" | "TERMINATE" | "TERMINATE_UPGRADE" | "STAY" | "MOVE";
  upgradeTo: string | null;
  moveToCompanyId: string | null;
  installDate: Date | string | null;
  startDate: Date | string | null;
  contractNumber: string | null;
  contractType: string | null;
  rentalStartDate: Date | string | null;
  rentalEndDate: Date | string | null;
  rentalAmountExVat: number | string | null;
  rentalMonthsRemaining: number | null;
  isLifted: boolean;
  currentBalance: number;
  lastReadingDate: Date | string | null;
  lastSyncedAt: Date | string | null;
  company: {
    id: string;
    name: string;
    bmsSchema: string;
    region: string | null;
  };
  category: {
    id: string;
    name: string;
  } | null;
  model: {
    id: string;
    name: string;
    makeName: string | null;
    isColor: boolean;
    monthlyDutyCycle: number | null;
  } | null;
  readings?: MeterReading[];
}

export interface MeterReading {
  id: string;
  machineId: string;
  readingDate: Date | string;
  readingDateTime: Date | string | null;
  total: number;
  a3: number | null;
  black: number | null;
  large: number | null;
  colour: number | null;
  extraLarge: number | null;
  incrementalTotal: number | null;
  incrementalA3: number | null;
  incrementalBlack: number | null;
  incrementalLarge: number | null;
  incrementalColour: number | null;
  incrementalXl: number | null;
  isReported: boolean;
  forBilling: boolean;
  isOpeningReading: boolean;
  isClosingReading: boolean;
  source: string;
}

export interface CompanyStats {
  id: string;
  name: string;
  bmsSchema: string;
  region: string | null;
  machineCount: number;
  statistics: {
    totalVolume: number;
    totalColorVolume: number;
    totalBlackVolume: number;
    totalCurrentBalance: number;
    avgVolumePerMachine: number;
    dailyAverage: number;
    monthlyAverage: number;
    colorPercentage: number;
  };
  categoryBreakdown: { category: string; count: number; volume: number }[];
  topModels: { model: string; count: number; volume: number }[];
}

export interface DashboardStats {
  summary: {
    totalMachines: number;
    activeMachines: number;
    totalBalance: number;
    totalVolumeInPeriod: number;
    totalColorVolume: number;
    totalBlackVolume: number;
    avgVolumePerMachine: number;
    dailyAverage: number;
    monthlyAverage: number;
    companiesCount: number;
    categoriesCount: number;
    colorPercentage: number;
  };
  period: {
    days: number;
    start: string;
    end: string;
  };
  lastSync: {
    completedAt: string;
    machinesProcessed: number;
    readingsProcessed: number;
  } | null;
  machinesByStatus: { status: string; count: number }[];
  machinesByCategory: { category: string; count: number }[];
  modelDistribution: { model: string; count: number; totalBalance: number }[];
  volumeByMonth: { month: string; total: number; color: number; black: number }[];
  topPerformers: {
    id: string;
    serialNumber: string;
    modelName: string | null;
    company: string;
    category: string | null;
    periodVolume: number;
    currentBalance: number;
  }[];
}

export interface ModelAnalytics {
  modelName: string;
  makeName: string | null;
  machineCount: number;
  statistics: {
    totalVolume: number;
    averageVolumePerMachine: number;
    averageMonthlyPerMachine: number;
    minVolume: number;
    maxVolume: number;
    standardDeviation: number;
  };
  outliers: {
    highPerformers: number;
    lowPerformers: number;
  };
  machines: {
    id: string;
    serialNumber: string;
    company: { id: string; name: string };
    currentBalance: number;
    installDate: string | null;
    totalVolumeInPeriod: number;
    dailyAverage: number;
    monthlyAverage: number;
    readingsCount: number;
    lastReadingDate: string | null;
    colorVolume: number;
    blackVolume: number;
  }[];
}

export interface ScenarioMove {
  machineId: string;
  machine: MachineWithRelations;
  fromCompanyId: string;
  toCompanyId: string;
  fromCompanyName: string;
  toCompanyName: string;
}

export interface ScenarioWithMoves {
  id: string;
  name: string;
  description: string | null;
  status: "DRAFT" | "PROPOSED" | "APPROVED" | "IMPLEMENTED" | "ARCHIVED";
  createdAt: Date | string;
  moves: ScenarioMove[];
}

export interface MachineUtilization {
  machineId: string;
  serialNumber: string;
  modelName: string | null;
  categoryName: string | null;
  companyId: string;
  companyName: string;
  currentBalance: number;
  avgMonthlyVolume: number;
  volumeMtd: number;
  volume3m: number;
  volume6m: number;
  volume12m: number;
  dutyCycle: number;
  utilizationPercent: number;
  utilizationStatus: "critical" | "low" | "optimal" | "high" | "overworked";
  volumeTrend: number;
  trendDirection: "up" | "down" | "stable";
  contractEndDate: string | null;
  contractMonthsRemaining: number | null;
  rentalAmount: number | null;
  contractType: string | null;
  daysSinceLastReading: number | null;
  machineAgeMonths: number | null;
  isLifted: boolean;
  // FSMA Lease Cost (calculated from volume × rates)
  monthlyCost: number;
  monoCost: number;
  colourCost: number;
  hasRates: boolean;
  // Lift scoring
  liftScore: number;
  insights: string[];
}

export interface MachineWithUtilization extends MachineWithRelations {
  utilization?: MachineUtilization;
  currentRate?: MachineRate;
}

export interface MachineRate {
  id: string;
  machineId: string;
  bmsMachinesId: number | null;
  category: string;
  ratesFrom: Date | string;
  meters: number | null;
  a4Mono: number | null;
  a3Mono: number | null;
  a4Colour: number | null;
  a3Colour: number | null;
  colourExtraLarge: number | null;
  dateSaved: Date | string | null;
  savedBy: number | null;
}

export interface SyncStatus {
  history: {
    id: string;
    syncType: string;
    targetCompany: string | null;
    startedAt: string;
    completedAt: string | null;
    companiesProcessed: number;
    machinesProcessed: number;
    readingsProcessed: number;
    status: "RUNNING" | "COMPLETED" | "FAILED";
    errors: string | null;
  }[];
  lastSuccessfulSync: {
    completedAt: string;
    machinesProcessed: number;
    readingsProcessed: number;
  } | null;
  totals: {
    machines: number;
    readings: number;
    companies: number;
  };
}
