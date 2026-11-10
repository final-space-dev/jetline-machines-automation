/**
 * How a store's machines split across the utilisation bands.
 *
 * A machine with no reading at all (`daysSinceLastReading === null`) has no
 * utilisation to speak of: the route still answers 0% for it, which would
 * read as "Critical, lift candidate". Such machines are counted apart, under
 * `noReadings`, and stay out of every band and out of the average.
 */
export interface UtilizationFigures {
  utilizationPercent: number;
  utilizationStatus: string;
  liftScore: number;
  daysSinceLastReading: number | null;
}

export interface UtilizationSummary {
  /** Machines with readings: the ones the bands and the average describe. */
  total: number;
  critical: number;
  low: number;
  optimal: number;
  high: number;
  overworked: number;
  liftCandidates: number;
  avgUtilization: number;
  /** Machines the route answered for that have never sent a reading. */
  noReadings: number;
}

/** True when the machine has at least one reading behind its figures. */
export function hasReadings(u: UtilizationFigures | undefined | null): u is UtilizationFigures {
  return !!u && u.daysSinceLastReading !== null && u.daysSinceLastReading !== undefined;
}

/** Null when the route answered for no machine at all. */
export function summariseUtilization(figures: (UtilizationFigures | undefined | null)[]): UtilizationSummary | null {
  const answered = figures.filter((u): u is UtilizationFigures => !!u);
  if (answered.length === 0) return null;
  const read = answered.filter(hasReadings);
  const band = (name: string) => read.filter((u) => u.utilizationStatus === name).length;
  return {
    total: read.length,
    critical: band("critical"),
    low: band("low"),
    optimal: band("optimal"),
    high: band("high"),
    overworked: band("overworked"),
    liftCandidates: read.filter((u) => u.liftScore >= 70).length,
    avgUtilization: read.length ? Math.round(read.reduce((sum, u) => sum + (u.utilizationPercent || 0), 0) / read.length) : 0,
    noReadings: answered.length - read.length,
  };
}
