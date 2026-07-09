"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";

// Account page. Shows the signed-in user and a change-password form shell
// built from the Jetline UI kit. The submit is wired in a later phase together
// with the backend endpoint, so the button stays disabled here rather than
// pretending to change a password.
export default function AccountPage() {
  // useSession() can return undefined during static prerender (no SessionProvider
  // in the tree at build time), so guard the same way lib/use-role.ts does.
  const session = useSession();
  const user = session?.data?.user;
  const name = user?.name || "";
  const email = user?.email || "";
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();

  return (
    <AppShell>
      <div style={{ maxWidth: 560, display: "flex", flexDirection: "column", gap: "var(--s-6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)" }}>
          <Link
            href="/stores"
            className="jl-btn jl-btn--ghost jl-btn--icon jl-btn--sm"
            aria-label="Back to stores"
          >
            <ArrowLeft />
          </Link>
          <h1 className="jl-h1">Account</h1>
        </div>

        <div className="jl-card">
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-4)" }}>
            <span className="jl-avatar jl-avatar--lg" aria-hidden="true">
              {initial}
            </span>
            <div>
              <div className="jl-h3">{name || "Signed-in user"}</div>
              {email && <div className="jl-sm jl-muted">{email}</div>}
            </div>
          </div>
        </div>

        <div className="jl-card">
          <div className="jl-card__head">
            <div className="jl-card__title">Change password</div>
          </div>

          <form
            style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="jl-field">
              <label htmlFor="acc-current">Current password</label>
              <input id="acc-current" className="jl-input" type="password" autoComplete="current-password" disabled />
            </div>
            <div className="jl-field">
              <label htmlFor="acc-new">New password</label>
              <input id="acc-new" className="jl-input" type="password" autoComplete="new-password" disabled />
            </div>
            <div className="jl-field">
              <label htmlFor="acc-confirm">Confirm new password</label>
              <input id="acc-confirm" className="jl-input" type="password" autoComplete="new-password" disabled />
              <span className="hint">Password changes will be enabled in an upcoming release.</span>
            </div>
            <div>
              <button type="submit" className="jl-btn jl-btn--primary" disabled aria-disabled="true">
                Update password
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
