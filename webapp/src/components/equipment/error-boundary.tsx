"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

interface State {
  hasError: boolean;
  error: Error | null;
}

export class EquipmentErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[Equipment] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div
        style={{
          fontFamily: "var(--jl-font)",
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
        }}
      >
        <div
          style={{
            background: "var(--jl-surface)",
            boxShadow: "var(--jl-sh-md)",
            borderRadius: "var(--jl-r-xl)",
            padding: "40px 48px",
            maxWidth: 480,
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "rgba(230,18,31,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <AlertTriangle size={22} style={{ color: "var(--jl-red-500)" }} />
          </div>
          <h2
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: "var(--jl-ink-900)",
              letterSpacing: "-0.02em",
              marginBottom: 10,
            }}
          >
            Something went wrong
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--jl-ink-400)",
              marginBottom: 24,
              lineHeight: 1.6,
            }}
          >
            {this.state.error?.message ?? "An unexpected error occurred in the Equipment section."}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 36,
                padding: "0 16px",
                borderRadius: "var(--jl-r-sm)",
                background: "var(--jl-red-500)",
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "var(--jl-font)",
                cursor: "pointer",
                border: "none",
                boxShadow: "var(--jl-sh-red)",
              }}
            >
              Try again
            </button>
            <Link
              href="/equipment"
              style={{
                display: "inline-flex",
                alignItems: "center",
                height: 36,
                padding: "0 16px",
                borderRadius: "var(--jl-r-sm)",
                background: "transparent",
                color: "var(--jl-ink-500)",
                fontSize: 13,
                fontWeight: 600,
                fontFamily: "var(--jl-font)",
                cursor: "pointer",
                border: "1.5px solid var(--jl-ink-200)",
                textDecoration: "none",
              }}
            >
              Back to Equipment CRM
            </Link>
          </div>
        </div>
      </div>
    );
  }
}
