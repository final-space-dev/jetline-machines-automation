/**
 * FSMA Lease Cost Calculation Utilities
 *
 * Cost = Volume (printer clicks) × Rate per click
 *
 * This calculates the ZAR (Rand) cost that we PAY to FSMA for leased printers.
 * Each colour/size type has its own rate, and cost is calculated per category.
 */

import type { MachineRate, MeterReading } from "@/types";

export interface CostBreakdown {
  monoCost: number;       // Black/mono impressions × mono rate
  colourCost: number;     // Colour impressions × colour rate
  a3MonoCost: number;     // A3 mono impressions × A3 mono rate
  a3ColourCost: number;   // A3 colour impressions × A3 colour rate
  xlCost: number;         // Extra large impressions × XL rate
  totalCost: number;      // Sum of all costs
}

export interface MachineCost extends CostBreakdown {
  machineId: string;
  periodDays: number;
  monthlyCost: number;    // Projected monthly based on period
  hasRates: boolean;
  rateEffectiveDate: string | null;
}

/**
 * Calculate cost for a set of readings using the applicable rate
 *
 * @param readings - Array of meter readings with incremental values
 * @param rate - The rate to apply (should be the rate effective during the period)
 * @returns Cost breakdown in ZAR
 */
export function calculateCost(
  readings: MeterReading[],
  rate: MachineRate | null | undefined
): CostBreakdown {
  const result: CostBreakdown = {
    monoCost: 0,
    colourCost: 0,
    a3MonoCost: 0,
    a3ColourCost: 0,
    xlCost: 0,
    totalCost: 0,
  };

  if (!rate) return result;

  // Sum up all incremental values from readings
  let totalMono = 0;
  let totalColour = 0;
  let totalA3 = 0;
  let totalXl = 0;

  for (const reading of readings) {
    if (reading.incrementalBlack) {
      totalMono += reading.incrementalBlack;
    }
    if (reading.incrementalColour) {
      totalColour += reading.incrementalColour;
    }
    if (reading.incrementalA3) {
      totalA3 += reading.incrementalA3;
    }
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

  result.monoCost = totalMono * monoRate;
  result.colourCost = totalColour * colourRate;

  if (a3ColourRate > 0) {
    result.a3ColourCost = totalA3 * a3ColourRate;
  } else {
    result.a3MonoCost = totalA3 * a3MonoRate;
  }

  result.xlCost = totalXl * xlRate;

  result.totalCost =
    result.monoCost +
    result.colourCost +
    result.a3MonoCost +
    result.a3ColourCost +
    result.xlCost;

  return result;
}

/**
 * Calculate cost from incremental volume values
 * Used when we have pre-calculated monthly incremental values
 */
export function calculateCostFromIncrementals(
  incrementalBlack: number,
  incrementalColour: number,
  incrementalA3: number,
  incrementalXl: number,
  rate: MachineRate | null | undefined,
  isColorMachine: boolean = true
): CostBreakdown {
  const result: CostBreakdown = {
    monoCost: 0,
    colourCost: 0,
    a3MonoCost: 0,
    a3ColourCost: 0,
    xlCost: 0,
    totalCost: 0,
  };

  if (!rate) return result;

  const monoRate = Number(rate.a4Mono) || 0;
  const colourRate = Number(rate.a4Colour) || 0;
  const a3MonoRate = Number(rate.a3Mono) || 0;
  const a3ColourRate = Number(rate.a3Colour) || 0;
  const xlRate = Number(rate.colourExtraLarge) || 0;

  result.monoCost = incrementalBlack * monoRate;
  result.colourCost = incrementalColour * colourRate;

  if (isColorMachine && a3ColourRate > 0) {
    result.a3ColourCost = incrementalA3 * a3ColourRate;
  } else {
    result.a3MonoCost = incrementalA3 * a3MonoRate;
  }

  result.xlCost = incrementalXl * xlRate;

  result.totalCost =
    result.monoCost +
    result.colourCost +
    result.a3MonoCost +
    result.a3ColourCost +
    result.xlCost;

  return result;
}

/**
 * Format cost value for display
 * @param value - Cost in ZAR (Rand)
 * @returns Formatted string with R symbol
 */
export function formatCost(value: number): string {
  if (value === 0) return "R0.00";
  if (value < 1000) return `R${value.toFixed(2)}`;
  if (value < 1000000) return `R${(value / 1000).toFixed(1)}k`;
  return `R${(value / 1000000).toFixed(2)}m`;
}

/**
 * Format cost for detailed display (no abbreviation)
 */
export function formatCostDetailed(value: number): string {
  return `R${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
