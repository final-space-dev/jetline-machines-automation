import { jlPage } from "@/lib/jl";

export function SetupStub({ heading }: { heading: string }) {
  return (
    <div style={{ ...jlPage, padding: 0 }}>
      <h1
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: "var(--jl-ink-900)",
          letterSpacing: "-0.02em",
          margin: 0,
        }}
      >
        {heading}
      </h1>

      <div
        style={{
          marginTop: 24,
          padding: "48px 32px",
          background: "var(--jl-surface)",
          boxShadow: "var(--jl-sh-sm)",
          borderRadius: "var(--jl-r-lg)",
          textAlign: "center",
        }}
      >
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--jl-ink-500)", margin: 0 }}>
          Coming in Phase 05
        </p>
      </div>
    </div>
  );
}
