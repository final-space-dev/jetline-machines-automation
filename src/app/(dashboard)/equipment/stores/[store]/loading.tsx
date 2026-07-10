import { AppShell } from "@/components/layout/app-shell";
import { Skeleton, ShimmerStyle } from "@/components/equipment/skeleton";

export default function Loading() {
  return (
    <AppShell>
      <ShimmerStyle />
      <div style={{ fontFamily: "var(--jl-font)", background: "var(--jl-canvas)", minHeight: "100%", padding: "32px 40px" }}>
        <Skeleton width={180} height={12} style={{ marginBottom: 24 }} />
        <Skeleton width={240} height={28} style={{ marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 16, marginBottom: 24 }}>
          <Skeleton width={140} height={14} />
          <Skeleton width={120} height={14} />
        </div>
        <div style={{ display: "flex", gap: 2, marginBottom: 20 }}>
          <Skeleton width={110} height={38} />
          <Skeleton width={110} height={38} />
        </div>
        <div style={{ background: "var(--jl-surface)", borderRadius: "var(--jl-r-lg)", boxShadow: "var(--jl-sh-sm)", padding: 24 }}>
          <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
            <Skeleton width={220} height={36} />
            <Skeleton width={120} height={36} />
            <div style={{ marginLeft: "auto" }}>
              <Skeleton width={120} height={36} />
            </div>
          </div>
          {[1,2,3,4,5].map((i) => (
            <div key={i} style={{ display: "flex", gap: 14, padding: "12px 0", borderBottom: "1px solid var(--jl-ink-50)" }}>
              <Skeleton width="15%" height={14} />
              <Skeleton width="20%" height={14} />
              <Skeleton width="15%" height={14} />
              <Skeleton width="25%" height={14} />
              <Skeleton width="10%" height={14} />
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
