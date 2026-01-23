/**
 * Revenue Calculation Utilities
 *
 * Revenue = Volume (printer clicks) × Rate per click
 *
 * This calculates the ZAR (Rand) value that FSMA charges for printing services.
 * Each colour/size type has its own rate, and revenue is calculated per category.
 */

import type { MachineRate, MeterReading } from "@/types";

export interface RevenueBreakdown {
  monoRevenue: number;      // Black/mono impressions × mono rate
  colourRevenue: number;    // Colour impressions × colour rate
  a3MonoRevenue: number;    // A3 mono impressions × A3 mono rate
  a3ColourRevenue: number;  // A3 colour impressions × A3 colour rate
  xlRevenue: number;        // Extra large impressions × XL rate
  totalRevenue: number;     // Sum of all revenue
}

export interface MachineRevenue extends RevenueBreakdown {
  machineId: string;
  periodDays: number;
  monthlyRevenue: number;   // Projected monthly based on period
  hasRates: boolean;
  rateEffectiveDate: string | null;
}

/**
 * Calculate revenue for a set of readings using the applicable rate
 *
 * @param readings - Array of meter readings with incremental values
 * @param rate - The rate to apply (should be the rate effective during the period)
 * @returns Revenue breakdown in ZAR
 */
export function calculateRevenue(
  readings: MeterReading[],
  rate: MachineRate | null | undefined
): RevenueBreakdown {
  const result: RevenueBreakdown = {
    monoRevenue: 0,
    colourRevenue: 0,
    a3MonoRevenue: 0,
    a3ColourRevenue: 0,
    xlRevenue: 0,
    totalRevenue: 0,
  };

  if (!rate) return result;

  // Sum up all incremental values from readings
  let totalMono = 0;
  let totalColour = 0;
  let totalA3 = 0;
  let totalXl = 0;

  for (const reading of readings) {
    // Black/mono impressions
    if (reading.incrementalBlack) {
      totalMono += reading.incrementalBlack;
    }
    // Colour impressions
    if (reading.incrementalColour) {
      totalColour += reading.incrementalColour;
    }
    // A3 impressions - we'll need to determine if mono or colour
    // For now, allocate based on machine category or split evenly
    if (reading.incrementalA3) {
      totalA3 += reading.incrementalA3;
    }
    // Extra large impressions
    if (reading.incrementalXl) {
      totalXl += reading.incrementalXl;
    }
  }

  // Apply rates - rates are stored as decimal (e.g., 0.035 = R0.035 per click)
  const monoRate = Number(rate.a4Mono) || 0;
  const colourRate = Number(rate.a4Colour) || 0;
  const a3MonoRate = Number(rate.a3Mono) || 0;
  const a3ColourRate = Number(rate.a3Colour) || 0;
  const xlRate = Number(rate.colourExtraLarge) || 0;

  result.monoRevenue = totalMono * monoRate;
  result.colourRevenue = totalColour * colourRate;

  // For A3, if we have colour rate use it (likely colour machine), otherwise use mono
  // In a more sophisticated system, you'd track A3 mono vs A3 colour separately
  if (a3ColourRate > 0) {
    result.a3ColourRevenue = totalA3 * a3ColourRate;
  } else {
    result.a3MonoRevenue = totalA3 * a3MonoRate;
  }

  result.xlRevenue = totalXl * xlRate;

  result.totalRevenue =
    result.monoRevenue +
    result.colourRevenue +
    result.a3MonoRevenue +
    result.a3ColourRevenue +
    result.xlRevenue;

  return result;
}

/**
 * Calculate monthly revenue from volume averages
 *
 * @param avgMonthlyVolume - Average monthly total volume
 * @param colorPercentage - Percentage of volume that is colour (0-100)
 * @param rate - The applicable rate
 * @returns Estimated monthly revenue in ZAR
 */
export function calculateMonthlyRevenue(
  avgMonthlyVolume: number,
  colorPercentage: number,
  rate: MachineRate | null | undefined
): number {
  if (!rate || avgMonthlyVolume <= 0) return 0;

  const monoRate = Number(rate.a4Mono) || 0;
  const colourRate = Number(rate.a4Colour) || 0;

  // Split volume by colour percentage
  const colourVolume = avgMonthlyVolume * (colorPercentage / 100);
  const monoVolume = avgMonthlyVolume - colourVolume;

  return (monoVolume * monoRate) + (colourVolume * colourRate);
}

/**
 * Calculate revenue from incremental volume values
 * Used when we have pre-calculated monthly incremental values
 */
export function calculateRevenueFromIncrementals(
  incrementalBlack: number,
  incrementalColour: number,
  incrementalA3: number,
  incrementalXl: number,
  rate: MachineRate | null | undefined,
  isColorMachine: boolean = true
): RevenueBreakdown {
  const result: RevenueBreakdown = {
    monoRevenue: 0,
    colourRevenue: 0,
    a3MonoRevenue: 0,
    a3ColourRevenue: 0,
    xlRevenue: 0,
    totalRevenue: 0,
  };

  if (!rate) return result;

  const monoRate = Number(rate.a4Mono) || 0;
  const colourRate = Number(rate.a4Colour) || 0;
  const a3MonoRate = Number(rate.a3Mono) || 0;
  const a3ColourRate = Number(rate.a3Colour) || 0;
  const xlRate = Number(rate.colourExtraLarge) || 0;

  result.monoRevenue = incrementalBlack * monoRate;
  result.colourRevenue = incrementalColour * colourRate;

  // A3 allocation based on machine type
  if (isColorMachine && a3ColourRate > 0) {
    result.a3ColourRevenue = incrementalA3 * a3ColourRate;
  } else {
    result.a3MonoRevenue = incrementalA3 * a3MonoRate;
  }

  result.xlRevenue = incrementalXl * xlRate;

  result.totalRevenue =
    result.monoRevenue +
    result.colourRevenue +
    result.a3MonoRevenue +
    result.a3ColourRevenue +
    result.xlRevenue;

  return result;
}

/**
 * Format revenue value for display
 * @param value - Revenue in ZAR (Rand)
 * @returns Formatted string with R symbol
 */
export function formatRevenue(value: number): string {
  if (value === 0) return "R0.00";
  if (value < 1000) return `R${value.toFixed(2)}`;
  if (value < 1000000) return `R${(value / 1000).toFixed(1)}k`;
  return `R${(value / 1000000).toFixed(2)}m`;
}

/**
 * Format revenue for detailed display (no abbreviation)
 */
export function formatRevenueDetailed(value: number): string {
  return `R${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
