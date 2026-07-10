"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Search, Menu, ChevronDown, KeyRound, LogOut } from "lucide-react";
import { NotificationBell } from "@/components/layout/notification-bell";
import { MobileNavDrawer } from "@/components/layout/sidebar";

function openCommandPalette() {
  // CommandPalette self-registers this event (same path app-shell + bottom nav use).
  window.dispatchEvent(new Event("jl:open-command-palette"));
}

/* Profile / avatar dropdown. Uses the Jetline UI kit .jl-dropdown + .jl-menu.
   Shows the signed-in user, a Change password link, and Sign out. */
function ProfileMenu() {
  // useSession() can return undefined during static prerender — guard it like
  // lib/use-role.ts rather than destructuring directly.
  const session = useSession();
  const user = session?.data?.user;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const name = user?.name || "Account";
  const email = user?.email || "";
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="jl-dropdown" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 6px 4px 4px",
          borderRadius: "var(--r-pill)",
          background: "transparent",
          cursor: "pointer",
          transition: "background var(--t-fast)",
        }}
      >
        <span className="jl-avatar jl-avatar--sm" aria-hidden="true">
          {initial}
        </span>
        <ChevronDown
          className="jl-hide-mobile"
          size={16}
          style={{ color: "var(--ink-400)" }}
        />
      </button>

      <div className="jl-menu jl-menu--right" data-open={open ? "" : undefined} role="menu">
        <p className="jl-menu__label" style={{ textTransform: "none", letterSpacing: 0 }}>
          <span style={{ display: "block", fontSize: "var(--fs-sm)", fontWeight: 700, color: "var(--ink-900)" }}>
            {name}
          </span>
          {email && (
            <span style={{ display: "block", fontSize: "var(--fs-xs)", fontWeight: 500, color: "var(--ink-400)", marginTop: 2 }}>
              {email}
            </span>
          )}
        </p>
        <div className="jl-menu__sep" />
        <Link
          href="/account"
          role="menuitem"
          className="jl-menu__item"
          onClick={() => setOpen(false)}
        >
          <KeyRound /> Change password
        </Link>
        <button
          type="button"
          role="menuitem"
          className="jl-menu__item jl-menu__item--danger"
          onClick={() => {
            setOpen(false);
            signOut({ callbackUrl: "/login" });
          }}
        >
          <LogOut /> Sign out
        </button>
      </div>
    </div>
  );
}

export function Header() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <header
      className="flex items-center justify-between px-4 md:px-6"
      style={{
        height: 64,
        flex: "none",
        background: "var(--surface)",
        boxShadow: "var(--sh-sm)",
        zIndex: 1,
        fontFamily: "var(--font)",
      }}
    >
      {/* Left: mobile hamburger + logo (mobile) / desktop search trigger */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {/* Mobile: hamburger */}
        <button
          className="jl-show-mobile"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation menu"
          style={{
            width: 44,
            height: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "transparent",
            color: "var(--ink-700)",
            cursor: "pointer",
            marginLeft: -8,
          }}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Mobile: brand mark + Fleet wordmark (matches sidebar brand block) */}
        <div className="jl-show-mobile" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 32,
              height: 32,
              flex: "none",
              borderRadius: "var(--r-sm)",
              background:
                "linear-gradient(160deg, var(--red-400), var(--red-500) 55%, var(--red-600))",
              boxShadow: "var(--sh-red)",
              display: "grid",
              placeItems: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            J
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "var(--ink-900)", letterSpacing: "-0.03em", lineHeight: 1 }}>
              Jetline
            </span>
            <span
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: "#fff",
                background: "var(--red-500)",
                borderRadius: 8,
                padding: "2px 8px 3px 6px",
                marginLeft: 4,
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              Fleet
            </span>
          </div>
        </div>

        {/* Desktop: full search trigger */}
        <button
          onClick={openCommandPalette}
          className="jl-hide-mobile"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 12px",
            borderRadius: "var(--r-sm)",
            background: "var(--ink-50)",
            boxShadow: "var(--sh-inset)",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font)",
            fontSize: 13,
            color: "var(--ink-400)",
            transition: "background var(--t-fast), box-shadow var(--t-fast)",
            minWidth: 240,
            userSelect: "none",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--ink-100)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--ink-50)";
          }}
        >
          <Search size={14} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, textAlign: "left" }}>Search stores &amp; equipment…</span>
          <kbd style={{
            background: "var(--surface)",
            boxShadow: "var(--sh-xs)",
            borderRadius: 4,
            padding: "1px 6px",
            fontSize: 11,
            fontFamily: "var(--mono)",
            color: "var(--ink-400)",
            letterSpacing: 0,
            lineHeight: "18px",
          }}>⌘K</kbd>
        </button>
      </div>

      <div className="flex items-center gap-2 md:gap-3">
        {/* DB-backed alerts — the single notification bell */}
        <NotificationBell />

        {/* Profile / account dropdown */}
        <ProfileMenu />
      </div>

      {/* Mobile navigation drawer (opened by the hamburger) */}
      <MobileNavDrawer open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
    </header>
  );
}
