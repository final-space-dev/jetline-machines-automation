import { AppShell } from "@/components/layout/app-shell";

/**
 * Shown to a signed-in "custom" user who holds no grants yet (an admin created
 * the account but has not ticked any menu or config access). Not an error — it
 * tells them to contact an administrator.
 */
export default function NoAccessPage() {
  return (
    <AppShell>
      <div
        className="jl-card jl-card--pad-lg"
        style={{ maxWidth: 560, marginInline: "auto", textAlign: "center" }}
      >
        <h1 className="jl-h1" style={{ marginBottom: 8 }}>No access yet</h1>
        <p className="jl-muted">
          Your account doesn&apos;t have any sections enabled. Please ask an
          administrator to grant you access.
        </p>
      </div>
    </AppShell>
  );
}
