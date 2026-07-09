"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from "lucide-react";

interface JlDateProps {
  value: string | Date | null | undefined;
  onChange: (value: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  // Accept ISO strings and YYYY-MM-DD
  const iso = value.length >= 10 ? value.slice(0, 10) : value;
  const parts = iso.split("-");
  if (parts.length === 3) {
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (y && m && d) return new Date(y, m - 1, d);
  }
  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function formatDisplay(d: Date): string {
  const day = d.getDate();
  const month = MONTHS[d.getMonth()].slice(0, 3);
  return `${day} ${month} ${d.getFullYear()}`;
}

export function JlDate({
  value,
  onChange,
  placeholder = "Select date",
  disabled = false,
  style,
}: JlDateProps) {
  const selected = toDate(value);
  const [open, setOpen] = useState(false);
  const [focusDate, setFocusDate] = useState<Date>(selected ?? new Date());
  const rootRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // viewDate is derived from focusDate — no sync effect needed
  const year = focusDate.getFullYear();
  const month = focusDate.getMonth();

  const openMenu = useCallback(() => {
    const base = toDate(value) ?? new Date();
    setFocusDate(base);
    setOpen(true);
  }, [value]);

  // Click-outside to close (DOM side-effect only)
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Move DOM focus to the focused day cell for accessibility (DOM side-effect only)
  useEffect(() => {
    if (open && gridRef.current) {
      const el = gridRef.current.querySelector<HTMLElement>('[data-focused="true"]');
      el?.focus();
    }
  }, [open, focusDate]);

  const commit = useCallback(
    (d: Date) => {
      onChange(toISODate(d));
      setOpen(false);
    },
    [onChange],
  );

  const shiftFocus = useCallback((days: number) => {
    setFocusDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + days);
      return next;
    });
  }, []);

  const shiftMonth = useCallback((months: number) => {
    setFocusDate((d) => new Date(d.getFullYear(), d.getMonth() + months, d.getDate()));
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        shiftFocus(-1);
        break;
      case "ArrowRight":
        e.preventDefault();
        shiftFocus(1);
        break;
      case "ArrowUp":
        e.preventDefault();
        shiftFocus(-7);
        break;
      case "ArrowDown":
        e.preventDefault();
        shiftFocus(7);
        break;
      case "PageUp":
        e.preventDefault();
        shiftMonth(-1);
        break;
      case "PageDown":
        e.preventDefault();
        shiftMonth(1);
        break;
      case "Enter":
        e.preventDefault();
        commit(focusDate);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  // Build the calendar grid (Monday-first)
  const firstOfMonth = new Date(year, month, 1);
  // JS: 0=Sun … 6=Sat. Convert to Monday-first offset.
  const startOffset = (firstOfMonth.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div ref={rootRef} style={{ position: "relative", ...style }}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return;
          if (open) setOpen(false);
          else openMenu();
        }}
        onKeyDown={onKeyDown}
        style={{
          width: "100%",
          height: 40,
          padding: "0 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          borderRadius: "var(--jl-r-sm)",
          border: "1.5px solid var(--jl-ink-200)",
          background: "var(--jl-surface)",
          fontSize: 13,
          fontFamily: "var(--jl-font)",
          color: selected ? "var(--jl-ink-900)" : "var(--jl-ink-400)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.6 : 1,
          outline: "none",
          textAlign: "left",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: selected ? 600 : 500 }}>
          <CalendarIcon size={14} style={{ color: "var(--jl-ink-400)", flexShrink: 0 }} />
          {selected ? formatDisplay(selected) : placeholder}
        </span>
        {selected && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Clear date"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--jl-ink-300)",
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose date"
          onKeyDown={onKeyDown}
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 50,
            width: 280,
            padding: 14,
            background: "var(--jl-surface)",
            boxShadow: "var(--jl-sh-lg)",
            borderRadius: "var(--jl-r-md)",
            border: "1px solid var(--jl-ink-100)",
          }}
        >
          {/* Header: month nav */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
              style={navBtn}
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 800, color: "var(--jl-ink-900)", fontFamily: "var(--jl-font)" }}>
              {MONTHS[month]} {year}
            </span>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
              style={navBtn}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Weekday header */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
            {WEEKDAYS.map((w) => (
              <div
                key={w}
                style={{
                  height: 24,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  color: "var(--jl-ink-400)",
                  fontFamily: "var(--jl-font)",
                }}
              >
                {w}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div ref={gridRef} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
            {cells.map((d, i) => {
              if (!d) return <div key={`e-${i}`} className="jl-date-empty" style={{ height: 32 }} />;
              const isSelected = selected != null && sameDay(d, selected);
              const isToday = sameDay(d, today);
              const isFocused = sameDay(d, focusDate);
              return (
                <button
                  key={toISODate(d)}
                  type="button"
                  className="jl-date-cell"
                  data-focused={isFocused ? "true" : undefined}
                  aria-pressed={isSelected}
                  tabIndex={isFocused ? 0 : -1}
                  onClick={() => commit(d)}
                  onMouseEnter={() => setFocusDate(d)}
                  style={{
                    height: 32,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "var(--jl-r-sm)",
                    border: isToday && !isSelected ? "1.5px solid var(--jl-red-300)" : "1.5px solid transparent",
                    background: isSelected
                      ? "var(--jl-red-500)"
                      : isFocused
                      ? "var(--jl-red-tint)"
                      : "transparent",
                    color: isSelected ? "#fff" : "var(--jl-ink-800)",
                    fontSize: 12,
                    fontWeight: isSelected || isToday ? 800 : 500,
                    fontFamily: "var(--jl-font)",
                    cursor: "pointer",
                    outline: "none",
                    transition: "background var(--jl-t-fast) var(--jl-ease)",
                  }}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer: Today shortcut */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, gap: 8 }}>
            <button
              type="button"
              onClick={() => commit(new Date())}
              style={{
                flex: 1,
                height: 32,
                borderRadius: "var(--jl-r-sm)",
                border: "1.5px solid var(--jl-ink-200)",
                background: "transparent",
                color: "var(--jl-ink-600)",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: "var(--jl-font)",
                cursor: "pointer",
              }}
            >
              Today
            </button>
            {selected && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                style={{
                  flex: 1,
                  height: 32,
                  borderRadius: "var(--jl-r-sm)",
                  border: "1.5px solid var(--jl-ink-200)",
                  background: "transparent",
                  color: "var(--jl-red-500)",
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: "var(--jl-font)",
                  cursor: "pointer",
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--jl-r-sm)",
  border: "1.5px solid var(--jl-ink-200)",
  background: "var(--jl-surface)",
  color: "var(--jl-ink-600)",
  cursor: "pointer",
};
