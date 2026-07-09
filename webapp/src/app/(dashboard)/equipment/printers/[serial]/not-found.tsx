"use client";

import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Printer } from "lucide-react";

export default function PrinterNotFound() {
  return (
    <AppShell>
      <div style={{
        fontFamily: "var(--jl-font)",
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
        background: "var(--jl-canvas)",
      }}>
        <div style={{
          background: "var(--jl-surface)",
          boxShadow: "var(--jl-sh-md)",
          borderRadius: "var(--jl-r-xl)",
          padding: "40px 48px",
          maxWidth: 400,
          textAlign: "center",
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "var(--jl-ink-100)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <Printer size={22} style={{ color: "var(--jl-ink-400)" }} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--jl-ink-900)", letterSpacing: "-0.02em", marginBottom: 10 }}>
            Printer not found
          </h2>
          <p style={{ fontSize: 13, color: "var(--jl-ink-400)", marginBottom: 24, lineHeight: 1.6 }}>
            This serial number is not in the active Xerox fleet.
          </p>
          <Link href="/equipment" style={{
            display: "inline-flex", alignItems: "center", height: 36, padding: "0 20px",
            borderRadius: "var(--jl-r-sm)", background: "var(--jl-red-500)", color: "#fff",
            fontSize: 13, fontWeight: 700, textDecoration: "none",
            boxShadow: "var(--jl-sh-red)",
          }}>
            Back to Equipment CRM
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
