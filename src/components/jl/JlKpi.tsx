import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";

export interface JlKpiTrend {
  dir: "up" | "down" | "flat";
  text: string;
}

export interface JlKpiProps {
  label: ReactNode;
  value: ReactNode;
  trend?: JlKpiTrend;
}

/** Compact metric card per the showcase. */
export function JlKpi({ label, value, trend }: JlKpiProps) {
  return (
    <div className="jl-kpi">
      <div className="jl-kpi__top">
        <span className="jl-kpi__label">{label}</span>
        {trend ? (
          <span className={`jl-trend jl-trend--${trend.dir}`}>
            {trend.dir === "up" ? <ArrowUp /> : null}
            {trend.dir === "down" ? <ArrowDown /> : null}
            {trend.text}
          </span>
        ) : null}
      </div>
      <div className="jl-kpi__value">{value}</div>
    </div>
  );
}

export interface JlKpiRowProps {
  children?: ReactNode;
}

/** Lays KPIs out in a responsive grid. */
export function JlKpiRow({ children }: JlKpiRowProps) {
  return <div className="jl-grid-kpi">{children}</div>;
}

export default JlKpi;
