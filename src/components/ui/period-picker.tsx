"use client";

import { useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PeriodValue {
  mode: "month" | "quarter" | "ytd" | "full-year";
  /** 1–12 for month/ytd; 1/4/7/10 for quarter start month; 0 for full-year */
  month: number;
  year: number;
  /** Human-readable label, e.g. "Q2 2024", "Oct 2024", "YTD to Sep 2024", "Full Year 2024" */
  label: string;
  startDate: string;
  endDate: string;
}

export interface PeriodPickerProps {
  value: PeriodValue;
  onChange: (v: PeriodValue) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear();
const MIN_YEAR = 2020;

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const QUARTERS: { label: string; month: number; range: string }[] = [
  { label: "Q1", month: 1,  range: "Jan – Mar" },
  { label: "Q2", month: 4,  range: "Apr – Jun" },
  { label: "Q3", month: 7,  range: "Jul – Sep" },
  { label: "Q4", month: 10, range: "Oct – Dec" },
];

const MODES: { id: PeriodValue["mode"]; label: string }[] = [
  { id: "month",     label: "Month"     },
  { id: "quarter",   label: "Quarter"   },
  { id: "ytd",       label: "YTD"       },
  { id: "full-year", label: "Full Year" },
];

// ─── Date helpers ─────────────────────────────────────────────────────────────

/** Last day of a given month (1-based) in a given year. */
function lastDay(year: number, month: number): number {
  // Day 0 of the *next* month === last day of the current month
  return new Date(year, month, 0).getDate();
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ─── Build a PeriodValue from raw parts ───────────────────────────────────────

function buildPeriod(
  mode: PeriodValue["mode"],
  month: number, // ignored for full-year; quarter start month; ytd end month; exact month for month
  year: number,
): PeriodValue {
  switch (mode) {
    case "month": {
      const end = lastDay(year, month);
      return {
        mode,
        month,
        year,
        label: `${MONTH_SHORT[month - 1]} ${year}`,
        startDate: isoDate(year, month, 1),
        endDate:   isoDate(year, month, end),
      };
    }
    case "quarter": {
      // month is the start month of the quarter: 1, 4, 7, or 10
      const endMonth = month + 2;
      const end = lastDay(year, endMonth);
      const qNum = Math.ceil(month / 3); // 1→1, 4→2, 7→3, 10→4
      return {
        mode,
        month,
        year,
        label: `Q${qNum} ${year}`,
        startDate: isoDate(year, month, 1),
        endDate:   isoDate(year, endMonth, end),
      };
    }
    case "ytd": {
      const end = lastDay(year, month);
      return {
        mode,
        month,
        year,
        label: `YTD to ${MONTH_SHORT[month - 1]} ${year}`,
        startDate: isoDate(year, 1, 1),
        endDate:   isoDate(year, month, end),
      };
    }
    case "full-year": {
      return {
        mode,
        month: 0,
        year,
        label: `Full Year ${year}`,
        startDate: isoDate(year, 1, 1),
        endDate:   isoDate(year, 12, 31),
      };
    }
  }
}

// ─── Exported default helper ──────────────────────────────────────────────────

export function getDefaultPeriod(): PeriodValue {
  const now = new Date();
  return buildPeriod("month", now.getMonth() + 1, now.getFullYear());
}

// ─── Sub-picker components ────────────────────────────────────────────────────

interface MonthGridProps {
  selectedMonth: number;
  onSelect: (m: number) => void;
  ytdMode?: boolean;
}

function MonthGrid({ selectedMonth, onSelect, ytdMode }: MonthGridProps) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {MONTH_SHORT.map((name, i) => {
        const m = i + 1;
        const active = m === selectedMonth;
        const isInRange = ytdMode && m <= selectedMonth;
        return (
          <button
            key={m}
            onClick={() => onSelect(m)}
            className={[
              "rounded px-1 py-1.5 text-xs font-medium transition-all duration-150 cursor-pointer",
              active
                ? "bg-[#0277B6] text-white shadow-sm shadow-sky-900/50"
                : isInRange
                  ? "bg-sky-950 text-sky-300 hover:bg-sky-900"
                  : "text-gray-400 hover:bg-gray-700 hover:text-gray-200",
            ].join(" ")}
          >
            {name}
          </button>
        );
      })}
    </div>
  );
}

interface QuarterGridProps {
  selectedMonth: number; // quarter start month
  onSelect: (startMonth: number) => void;
}

function QuarterGrid({ selectedMonth, onSelect }: QuarterGridProps) {
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {QUARTERS.map((q) => {
        const active = q.month === selectedMonth;
        return (
          <button
            key={q.month}
            onClick={() => onSelect(q.month)}
            className={[
              "rounded-md px-2 py-2.5 text-left transition-all duration-150 cursor-pointer",
              active
                ? "bg-[#0277B6] text-white shadow-sm shadow-sky-900/50"
                : "text-gray-300 hover:bg-gray-700",
            ].join(" ")}
          >
            <div className="text-sm font-semibold leading-none">{q.label}</div>
            <div className={["text-xs mt-0.5 leading-none", active ? "text-sky-200" : "text-gray-500"].join(" ")}>
              {q.range}
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PeriodPicker({ value, onChange }: PeriodPickerProps) {
  const { mode, month, year } = value;

  const emit = useCallback(
    (nextMode: PeriodValue["mode"], nextMonth: number, nextYear: number) => {
      onChange(buildPeriod(nextMode, nextMonth, nextYear));
    },
    [onChange],
  );

  // When switching modes, carry forward a sensible sub-selection
  function switchMode(nextMode: PeriodValue["mode"]) {
    if (nextMode === mode) return;
    let nextMonth = month;
    if (nextMode === "quarter") {
      // Snap to the nearest quarter start month
      nextMonth = [1, 1, 1, 4, 4, 4, 7, 7, 7, 10, 10, 10][month - 1] ?? 1;
    } else if (nextMode === "full-year") {
      nextMonth = 0;
    } else if (nextMode === "month" || nextMode === "ytd") {
      // If coming from full-year, default to January
      if (mode === "full-year") nextMonth = 1;
      // If coming from quarter, snap to the quarter's start month
      // (already the quarter start month from state, so keep it valid)
    }
    emit(nextMode, nextMonth, year);
  }

  function stepYear(delta: -1 | 1) {
    const next = year + delta;
    if (next < MIN_YEAR || next > CURRENT_YEAR) return;
    emit(mode, mode === "full-year" ? 0 : month, next);
  }

  return (
    <div className="w-full select-none">
      {/* ── Mode tabs ───────────────────────────────────────────────────────── */}
      <div className="flex rounded-lg bg-gray-800 p-0.5 mb-3">
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => switchMode(m.id)}
            className={[
              "flex-1 rounded-md py-1 text-xs font-medium transition-all duration-150 cursor-pointer",
              mode === m.id
                ? "bg-gray-600 text-white shadow-sm"
                : "text-gray-400 hover:text-gray-200",
            ].join(" ")}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* ── Sub-picker ──────────────────────────────────────────────────────── */}
      <div className="mb-3 min-h-[96px]">
        {mode === "month" && (
          <MonthGrid
            selectedMonth={month}
            onSelect={(m) => emit("month", m, year)}
          />
        )}
        {mode === "quarter" && (
          <QuarterGrid
            selectedMonth={month}
            onSelect={(m) => emit("quarter", m, year)}
          />
        )}
        {mode === "ytd" && (
          <MonthGrid
            selectedMonth={month}
            onSelect={(m) => emit("ytd", m, year)}
            ytdMode
          />
        )}
        {mode === "full-year" && (
          <div className="flex items-center justify-center h-24">
            <span className="text-2xl font-bold text-gray-100 tracking-wide">{year}</span>
          </div>
        )}
      </div>

      {/* ── Year selector ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between rounded-lg bg-gray-800 px-2 py-1.5">
        <button
          onClick={() => stepYear(-1)}
          disabled={year <= MIN_YEAR}
          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:bg-gray-700 hover:text-gray-100 disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
          aria-label="Previous year"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <span className="text-sm font-semibold text-gray-100 tabular-nums">{year}</span>

        <button
          onClick={() => stepYear(1)}
          disabled={year >= CURRENT_YEAR}
          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:bg-gray-700 hover:text-gray-100 disabled:opacity-25 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
          aria-label="Next year"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Active period label ─────────────────────────────────────────────── */}
      <div className="mt-2 px-1 text-center">
        <span className="text-xs text-sky-400 font-medium">{value.label}</span>
      </div>
    </div>
  );
}
