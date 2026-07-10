import type { ReactNode } from "react";

export interface JlTab {
  key: string;
  label: ReactNode;
  count?: number;
}

export interface JlTabsProps {
  tabs: JlTab[];
  active: string;
  onChange: (key: string) => void;
}

/** div.jl-tabs with aria-selected on the active button. Optional count badge. */
export function JlTabs({ tabs, active, onChange }: JlTabsProps) {
  return (
    <div className="jl-tabs" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === active}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className="jl-tabs__count">{tab.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/** Compact filter toggle. Same API, div.jl-segment. */
export function JlSegment({ tabs, active, onChange }: JlTabsProps) {
  return (
    <div className="jl-segment" role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === active}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className="jl-tabs__count">{tab.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export default JlTabs;
