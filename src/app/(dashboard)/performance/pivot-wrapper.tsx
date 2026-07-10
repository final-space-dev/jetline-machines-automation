"use client";

import { useEffect } from "react";
import {
  PivotTableUI,
  TableRenderers,
  aggregators,
} from "@imc-trading/react-pivottable";
import "@imc-trading/react-pivottable/pivottable.css";
import "./pivot-overrides.css";

interface PivotWrapperProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pivotState: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onPivotChange: (state: Record<string, any>) => void;
}

// Sort YYYY-MM strings chronologically (works across years)
function monthSorter(a: string, b: string) {
  return a.localeCompare(b);
}

// Sort month names chronologically
const MONTH_ORDER = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthNameSorter(a: string, b: string) {
  return MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b);
}

// Fields that should not appear in the aggregator value dropdowns
const HIDDEN_FROM_VALS = [
  "store",
  "group",
  "region",
  "category",
  "model",
  "make",
  "serial",
  "installDate",
  "year",
  "monthName",
  "month",
  "readingDate",
  "printType",
  "measure",
  "cpc",
];

export default function PivotWrapper({
  data,
  pivotState,
  onPivotChange,
}: PivotWrapperProps) {
  // Suppress react-beautiful-dnd warnings in dev
  useEffect(() => {
    const orig = window.console.warn;
    window.console.warn = (...args: unknown[]) => {
      if (
        typeof args[0] === "string" &&
        args[0].includes("react-beautiful-dnd")
      ) {
        return;
      }
      orig(...args);
    };
    return () => {
      window.console.warn = orig;
    };
  }, []);

  // Build default state merged with any user-modified state
  const defaultState = {
    rows: ["store"],
    cols: ["measure", "year", "monthName"],
    vals: ["value"],
    aggregatorName: "Sum",
    rendererName: "Table",
    sorters: {
      month: monthSorter,
      year: (a: string, b: string) => a.localeCompare(b),
      monthName: monthNameSorter,
    },
    hiddenFromAggregators: HIDDEN_FROM_VALS,
    hiddenFromDragDrop: [] as string[],
  };

  // If pivotState has user modifications, use those; otherwise use defaults.
  // Strip keys that don't survive JSON serialization (functions, renderers, etc.)
  const hasUserState = Object.keys(pivotState).length > 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { sorters: _s, renderers: _r, aggregators: _a, hiddenFromAggregators: _h, hiddenFromDragDrop: _hd, ...safeUserState } = pivotState;

  return (
    <PivotTableUI
      data={data}
      renderers={TableRenderers}
      aggregators={aggregators}
      {...defaultState}
      {...(hasUserState ? safeUserState : {})}
      onChange={(s: Record<string, unknown>) => {
        // Remove data from saved state to avoid circular refs
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { data: _d, ...rest } = s;
        onPivotChange(rest);
      }}
    />
  );
}
