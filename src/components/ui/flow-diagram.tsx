"use client";

// ============================================================================
// flow-diagram — self-contained KPI flow-diagram kit
//
// Drop this single file into any React + Tailwind project to build
// "decomposition tree" dashboards: bordered KPI cards and table nodes laid
// out with plain flexbox, connected by measured dotted SVG lanes that stay
// attached to their nodes whatever the content, data, zoom or screen size.
//
// Dependencies: React 18+ and Tailwind CSS (v3 JIT or v4). Nothing else.
// Colours fall back to hex values, so no design tokens are required; if the
// host project defines the --color-navy-800 / --color-grey-* / --color-text-*
// custom properties (as mmih-portal does) they take over automatically.
//
// Pieces:
//   <FlowCanvas edges={...} remeasureKey={...}>   draws the dotted lanes
//   <FlowCard id="..." accent="driver" ... />     KPI card node
//   <FlowTableNode id="..." ...>...</FlowTableNode>  node with a table inside
//   useFlowView()                                 zoom / fit / fullscreen / jump
//
// Minimal usage:
//
//   const EDGES: FlowEdge[] = [
//     { from: "driver", fromSide: "left", to: "total", toSide: "right", color: "#4ade80" },
//   ];
//
//   <FlowCanvas edges={EDGES} remeasureKey={periodKey}>
//     <div className="flex items-center gap-16">
//       <FlowCard id="total" accent="outcome" title="Total" value="R 1.2M" big />
//       <FlowCard id="driver" accent="driver" title="Driver" value="R 300k"
//         rows={[{ label: "Unutilised", value: "R 30k", tone: "danger" }]} />
//     </div>
//   </FlowCanvas>
//
// Nodes are matched to edges by the `id` prop (rendered as data-flow-id), so
// lay them out however you like — columns, rows, grids — and the lanes follow.
//
// For a full-screen dashboard, wrap the canvas in the refs from useFlowView:
//
//   const view = useFlowView({ initialWidth: 2500, initialHeight: 1400 });
//   <div ref={view.rootRef}>
//     <button onClick={() => view.setFitMode("screen")}>Fit screen</button>
//     <button onClick={view.toggleFullscreen}>TV mode</button>
//     <div ref={view.viewportRef} className="overflow-auto">
//       <div style={{ width: view.natural.w * view.zoom, height: view.natural.h * view.zoom }}>
//         <div ref={view.contentRef} className="w-[2500px] origin-top-left"
//           style={{ transform: `scale(${view.zoom})` }}>
//           <FlowCanvas ...>...</FlowCanvas>
//         </div>
//       </div>
//     </div>
//   </div>
// ============================================================================

import { useState, useRef, useCallback, useEffect, useLayoutEffect } from "react";
import type { ReactNode } from "react";

// ----------------------------------------------------------------------------
// Edges & measured lanes
// ----------------------------------------------------------------------------

export type Side = "left" | "right" | "top" | "bottom";

export interface FlowEdge {
  from: string;
  fromSide: Side;
  to: string;
  toSide: Side;
  color: string;
  /** Dotted by default; `false` draws a solid lane (a link that was measured). */
  dashed?: boolean;
}

interface MeasuredPath {
  d: string;
  arrow: string;
  color: string;
  dashed: boolean;
}

function isHorizontal(side: Side): boolean {
  return side === "left" || side === "right";
}

export function FlowCanvas({
  edges,
  remeasureKey,
  children,
}: {
  edges: FlowEdge[];
  remeasureKey: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<MeasuredPath[]>([]);

  const measure = useCallback(() => {
    const c = ref.current;
    if (!c) return;
    const crect = c.getBoundingClientRect();
    // Compensate for any CSS scale on an ancestor (e.g. the useFlowView zoom):
    // rects are in visual pixels, but the SVG draws in layout pixels.
    const scale = c.offsetWidth > 0 ? crect.width / c.offsetWidth : 1;

    const anchorOf = (r: DOMRect, side: Side) => {
      switch (side) {
        case "left":
          return { x: (r.left - crect.left) / scale, y: (r.top + r.height / 2 - crect.top) / scale };
        case "right":
          return { x: (r.right - crect.left) / scale, y: (r.top + r.height / 2 - crect.top) / scale };
        case "top":
          return { x: (r.left + r.width / 2 - crect.left) / scale, y: (r.top - crect.top) / scale };
        case "bottom":
          return { x: (r.left + r.width / 2 - crect.left) / scale, y: (r.bottom - crect.top) / scale };
      }
    };

    const next: MeasuredPath[] = [];
    for (const e of edges) {
      const fromEl = c.querySelector<HTMLElement>(`[data-flow-id="${e.from}"]`);
      const toEl = c.querySelector<HTMLElement>(`[data-flow-id="${e.to}"]`);
      if (!fromEl || !toEl) continue;
      const p1 = anchorOf(fromEl.getBoundingClientRect(), e.fromSide);
      const p2 = anchorOf(toEl.getBoundingClientRect(), e.toSide);

      // Endpoint stops 7px short of the target edge; arrow tip sits on the edge
      let ex = p2.x;
      let ey = p2.y;
      let arrow = "";
      switch (e.toSide) {
        case "right":
          ex = p2.x + 7;
          arrow = `M ${p2.x + 7} ${p2.y - 4} L ${p2.x + 1} ${p2.y} L ${p2.x + 7} ${p2.y + 4}`;
          break;
        case "left":
          ex = p2.x - 7;
          arrow = `M ${p2.x - 7} ${p2.y - 4} L ${p2.x - 1} ${p2.y} L ${p2.x - 7} ${p2.y + 4}`;
          break;
        case "top":
          ey = p2.y - 7;
          arrow = `M ${p2.x - 4} ${p2.y - 7} L ${p2.x} ${p2.y - 1} L ${p2.x + 4} ${p2.y - 7}`;
          break;
        case "bottom":
          ey = p2.y + 7;
          arrow = `M ${p2.x - 4} ${p2.y + 7} L ${p2.x} ${p2.y + 1} L ${p2.x + 4} ${p2.y + 7}`;
          break;
      }

      let d: string;
      if (isHorizontal(e.fromSide) && isHorizontal(e.toSide)) {
        const mx = (p1.x + ex) / 2;
        d = `M ${p1.x} ${p1.y} C ${mx} ${p1.y}, ${mx} ${ey}, ${ex} ${ey}`;
      } else if (!isHorizontal(e.fromSide) && !isHorizontal(e.toSide)) {
        const my = (p1.y + ey) / 2;
        d = `M ${p1.x} ${p1.y} C ${p1.x} ${my}, ${ex} ${my}, ${ex} ${ey}`;
      } else {
        d = `M ${p1.x} ${p1.y} L ${ex} ${ey}`;
      }
      next.push({ d, arrow, color: e.color, dashed: e.dashed !== false });
    }
    setPaths(next);
  }, [edges]);

  useLayoutEffect(() => {
    measure();
    const c = ref.current;
    if (!c) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(c);
    c.querySelectorAll<HTMLElement>("[data-flow-id]").forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [measure, remeasureKey]);

  return (
    <div ref={ref} className="relative">
      <svg className="absolute inset-0 w-full h-full pointer-events-none" aria-hidden="true">
        {paths.map((p, i) => (
          <g key={i}>
            <path d={p.d} stroke={p.color} strokeWidth="1.5" strokeDasharray={p.dashed ? "4 3" : undefined} fill="none" />
            <path d={p.arrow} stroke={p.color} strokeWidth="1.5" fill="none" />
          </g>
        ))}
      </svg>
      <div className="relative">{children}</div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Nodes — green = drivers, red = costs, blue = intermediates, navy = outcomes
// ----------------------------------------------------------------------------

export type FlowAccent = "driver" | "cost" | "intermediate" | "outcome" | "neutral";

const ACCENT_STYLES: Record<FlowAccent, { border: string; label: string }> = {
  driver: { border: "border-green-400", label: "text-green-600" },
  cost: { border: "border-red-400", label: "text-red-500" },
  intermediate: { border: "border-blue-400", label: "text-blue-500" },
  outcome: { border: "border-[var(--color-navy-800,#173050)]", label: "text-[var(--color-text-muted,#676c76)]" },
  neutral: { border: "border-[var(--color-grey-300,#c4c6cb)]", label: "text-[var(--color-text-muted,#676c76)]" },
};

export interface FlowRow {
  label: string;
  value: string;
  tone?: "danger" | "success" | "muted";
}

export function FlowCard({
  id,
  accent,
  title,
  value,
  growth,
  rows,
  big,
  small,
  className = "",
}: {
  id: string;
  accent: FlowAccent;
  title: string;
  value: string;
  growth?: string | null;
  rows?: FlowRow[];
  big?: boolean;
  small?: boolean;
  className?: string;
}) {
  const s = ACCENT_STYLES[accent];
  return (
    <div data-flow-id={id} className={`bg-white border-2 ${s.border} rounded-xl ${small ? "p-3" : "p-4"} shadow-sm ${className}`}>
      <div className={`${small ? "text-[10px]" : "text-[11px]"} uppercase tracking-wider font-semibold mb-1 ${s.label}`}>
        {title}
      </div>
      <div
        className={`${big ? "text-4xl" : small ? "text-xl" : "text-2xl"} font-bold text-[var(--color-text-primary,#1e2126)] tabular-nums`}
      >
        {value}
      </div>
      {growth != null && (
        <div className={`${small ? "text-[11px]" : "text-xs"} mt-1 font-medium text-[var(--color-text-muted,#676c76)]`}>
          {growth} YoY
        </div>
      )}
      {rows && rows.length > 0 && (
        <div className="mt-2.5 pt-2.5 border-t border-[var(--color-border-subtle,#ecedee)] space-y-1">
          {rows.map((r) => (
            <div key={r.label} className={`flex items-center justify-between gap-3 ${small ? "text-[10px]" : "text-[11px]"} leading-5`}>
              <span className="text-[var(--color-text-muted,#676c76)]">{r.label}</span>
              <span
                className={`tabular-nums font-medium whitespace-nowrap ${
                  r.tone === "danger"
                    ? "text-red-500"
                    : r.tone === "success"
                    ? "text-green-600"
                    : "text-[var(--color-text-secondary,#49505b)]"
                }`}
              >
                {r.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FlowTableNode({
  id,
  accent,
  title,
  value,
  children,
  className = "",
}: {
  id: string;
  accent: FlowAccent;
  title: string;
  value?: string;
  children: ReactNode;
  className?: string;
}) {
  const s = ACCENT_STYLES[accent];
  return (
    <div data-flow-id={id} className={`bg-white border-2 ${s.border} rounded-xl shadow-sm overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 border-b border-[var(--color-border-subtle,#ecedee)]">
        <span className={`text-[11px] uppercase tracking-wider font-semibold ${s.label}`}>{title}</span>
        {value && <span className="text-lg font-bold text-[var(--color-text-primary,#1e2126)] tabular-nums">{value}</span>}
      </div>
      {children}
    </div>
  );
}

// ----------------------------------------------------------------------------
// useFlowView — zoom / fit-width / fit-screen / fullscreen / jump-to-node
// ----------------------------------------------------------------------------

export type FitMode = "width" | "screen" | "manual";

export interface FlowViewOptions {
  initialWidth?: number;
  initialHeight?: number;
  minZoom?: number;
  maxZoom?: number;
}

export function useFlowView(options: FlowViewOptions = {}) {
  const { initialWidth = 1600, initialHeight = 900, minZoom = 0.3, maxZoom = 2 } = options;

  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [fitMode, setFitMode] = useState<FitMode>("width");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [natural, setNatural] = useState({ w: initialWidth, h: initialHeight });

  const clamp = useCallback((z: number) => Math.min(maxZoom, Math.max(minZoom, z)), [minZoom, maxZoom]);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const update = () => setNatural({ w: content.offsetWidth, h: content.offsetHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(content);
    return () => ro.disconnect();
  }, []);

  const applyFit = useCallback(
    (mode: "width" | "screen") => {
      const vp = viewportRef.current;
      if (!vp || natural.w === 0 || natural.h === 0) return;
      const availW = vp.clientWidth;
      if (mode === "width") {
        setZoom(clamp(availW / natural.w));
      } else {
        const top = vp.getBoundingClientRect().top;
        const availH = Math.max(window.innerHeight - top - 24, 200);
        setZoom(clamp(Math.min(availW / natural.w, availH / natural.h)));
      }
    },
    [natural, clamp]
  );

  useLayoutEffect(() => {
    if (fitMode === "manual") return;
    applyFit(fitMode);
    const onResize = () => applyFit(fitMode);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitMode, applyFit]);

  useEffect(() => {
    const onFsChange = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      setFitMode(fs ? "screen" : "width");
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      rootRef.current?.requestFullscreen();
    }
  }, []);

  const zoomBy = useCallback(
    (delta: number) => {
      setFitMode("manual");
      setZoom((z) => clamp(Math.round((z + delta) * 10) / 10));
    },
    [clamp]
  );

  const resetZoom = useCallback(() => {
    setFitMode("manual");
    setZoom(1);
  }, []);

  const jumpTo = useCallback((target: string) => {
    setFitMode("manual");
    setZoom((z) => (z < 0.85 ? 1 : z));
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        rootRef.current
          ?.querySelector(`[data-flow-id="${target}"]`)
          ?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      })
    );
  }, []);

  return {
    rootRef,
    viewportRef,
    contentRef,
    zoom,
    setZoom,
    fitMode,
    setFitMode,
    isFullscreen,
    toggleFullscreen,
    zoomBy,
    resetZoom,
    jumpTo,
    natural,
  };
}
