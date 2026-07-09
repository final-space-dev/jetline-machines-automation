"use client";

import React from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}

export function Skeleton({ width = "100%", height = 16, borderRadius = 6, style }: SkeletonProps) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, var(--jl-ink-100) 25%, var(--jl-ink-50) 50%, var(--jl-ink-100) 75%)",
        backgroundSize: "200% 100%",
        animation: "jl-shimmer 1.4s ease infinite",
        flexShrink: 0,
        ...style,
      }}
    />
  );
}

const shimmerCSS = `
@keyframes jl-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
`;

export function ShimmerStyle() {
  return <style dangerouslySetInnerHTML={{ __html: shimmerCSS }} />;
}

// Pre-built skeletons for equipment pages

export function EquipmentItemSkeleton() {
  const S: Record<string, React.CSSProperties> = {
    page: { fontFamily: "var(--jl-font)", background: "var(--jl-canvas)", color: "var(--jl-ink-900)", minHeight: "100%", padding: "32px 40px" },
    card: { background: "var(--jl-surface)", boxShadow: "var(--jl-sh-sm)", borderRadius: "var(--jl-r-lg)", padding: "24px 28px", marginBottom: 16 },
    label: { width: 80, height: 10, marginBottom: 12 },
    row: { display: "flex", gap: 16, marginBottom: 16 },
  };

  return (
    <>
      <ShimmerStyle />
      <div style={S.page}>
        {/* sticky bar skeleton */}
        <div style={{ height: 56, background: "var(--jl-surface)", borderRadius: "var(--jl-r-lg)", marginBottom: 24, boxShadow: "var(--jl-sh-sm)", display: "flex", alignItems: "center", padding: "0 24px", gap: 12 }}>
          <Skeleton width={160} height={18} />
          <div style={{ flex: 1 }} />
          <Skeleton width={80} height={32} />
          <Skeleton width={80} height={32} />
        </div>

        {/* Identity card */}
        <div style={S.card}>
          <Skeleton style={S.label} />
          <div style={S.row}>
            <Skeleton height={36} />
            <Skeleton height={36} />
          </div>
          <div style={S.row}>
            <Skeleton height={36} />
            <Skeleton height={36} />
            <Skeleton height={36} />
          </div>
        </div>

        {/* Condition card */}
        <div style={S.card}>
          <Skeleton style={S.label} />
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} width={90} height={32} />)}
          </div>
          <Skeleton height={80} />
        </div>

        {/* Procurement card */}
        <div style={S.card}>
          <Skeleton style={S.label} />
          <div style={S.row}>
            <Skeleton height={36} />
            <Skeleton height={36} />
            <Skeleton height={36} />
          </div>
        </div>
      </div>
    </>
  );
}

export function PrinterPageSkeleton() {
  const S: Record<string, React.CSSProperties> = {
    page: { fontFamily: "var(--jl-font)", background: "var(--jl-canvas)", color: "var(--jl-ink-900)", minHeight: "100%", padding: "32px 40px" },
    card: { background: "var(--jl-surface)", boxShadow: "var(--jl-sh-sm)", borderRadius: "var(--jl-r-lg)", padding: "24px 28px", marginBottom: 16 },
    row: { display: "flex", gap: 16, marginBottom: 16 },
  };

  return (
    <>
      <ShimmerStyle />
      <div style={S.page}>
        {/* sticky bar skeleton */}
        <div style={{ height: 56, background: "var(--jl-surface)", borderRadius: "var(--jl-r-lg)", marginBottom: 24, boxShadow: "var(--jl-sh-sm)", display: "flex", alignItems: "center", padding: "0 24px", gap: 12 }}>
          <Skeleton width={200} height={18} />
          <div style={{ flex: 1 }} />
          <Skeleton width={80} height={32} />
        </div>

        {/* Info grid card */}
        <div style={S.card}>
          <Skeleton width={100} height={10} style={{ marginBottom: 16 }} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i}>
                <Skeleton width={60} height={10} style={{ marginBottom: 8 }} />
                <Skeleton height={14} />
              </div>
            ))}
          </div>
        </div>

        {/* Condition card */}
        <div style={S.card}>
          <Skeleton width={140} height={10} style={{ marginBottom: 14 }} />
          <Skeleton height={80} style={{ marginBottom: 12 }} />
          <div style={{ display: "flex", gap: 8 }}>
            {[1, 2, 3].map((i) => <Skeleton key={i} width={80} height={32} />)}
          </div>
        </div>

        {/* Chart card */}
        <div style={S.card}>
          <Skeleton width={120} height={10} style={{ marginBottom: 14 }} />
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 80 }}>
            {[40, 65, 30, 80, 55, 90].map((h, i) => <Skeleton key={i} width={32} height={h} />)}
          </div>
        </div>
      </div>
    </>
  );
}
