"use client";

import * as React from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/ui/utils";
import { ToastProvider } from "@/components/ui/toast";
import { CommandPalette } from "@/components/ui/command-palette";
import { SHELL, CHROME } from "@/lib/ui/ui-tokens";

/**
 * The JetlineConsol app shell, generalised: one dark sidebar (logo row with
 * the face chip, optional face switch, the Jump launcher, the nav with its
 * two gliding bubbles, a footer with an optional session card and the
 * signed-in user) beside the canvas. Consol's AppShell read its menu, access
 * and session from its own modules; here every one of those is a prop.
 *
 * The chrome colours come from the --face-* variables through CHROME; the
 * "reporting" chrome flips them to maroon (data-face="reporting").
 */

export interface ShellNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** A group without a section label renders as top-level items. */
export interface ShellNavGroup {
  section?: string;
  items: ShellNavItem[];
}

export interface ShellFace {
  id: string;
  /** The switch half's word, e.g. "Consol". */
  label: string;
  /** Where that half lands. */
  href: string;
}

export interface ShellUser {
  name: string;
  email?: string;
}

const ICON = { className: "h-4 w-4 shrink-0", strokeWidth: 1.4 } as const;

/** Travelling-bubble transition (design-spec-v1 §1.9): 380ms spring on
 *  geometry, 200ms ease on opacity. */
const BUBBLE_TRANSITION =
  "transform .38s cubic-bezier(.2,.9,.2,1), height .38s cubic-bezier(.2,.9,.2,1), opacity .2s ease";

/** Active when the path matches and the item's query (if any) is satisfied; a
 *  bare item yields to a sibling on the same path whose query matches. */
function isNavItemActive(item: ShellNavItem, items: ShellNavItem[], pathname: string, search: string): boolean {
  const [path, query] = item.href.split("?");
  if (pathname !== path) return false;
  const have = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const matches = (q: string) => [...new URLSearchParams(q).entries()].every(([k, v]) => have.get(k) === v);
  if (query) return matches(query);
  return !items.some((sibling) => {
    const [siblingPath, siblingQuery] = sibling.href.split("?");
    return siblingPath === path && !!siblingQuery && matches(siblingQuery);
  });
}

/** The workspace/session card at the foot of the sidebar (Consol's open
 *  consolidation run): a name, an accent action and a quiet exit. */
export function ShellSessionCard({
  name,
  actionLabel = "Open",
  onAction,
  exitLabel = "Exit",
  onExit,
}: {
  name: string;
  actionLabel?: string;
  onAction?: () => void;
  exitLabel?: string;
  onExit?: () => void;
}) {
  return (
    <div className={`mb-2.5 flex items-center gap-2 rounded-[9px] border border-white/[.07] ${CHROME.card} px-2.5 py-2`}>
      <p className={`min-w-0 flex-1 truncate text-[11.5px] ${CHROME.text}`} title={name}>{name}</p>
      {onAction && (
        <button
          type="button"
          onClick={onAction}
          className={`rounded-[5px] ${CHROME.accent} px-1.5 py-[3px] text-[10.5px] font-semibold uppercase tracking-[0.02em] text-white transition-colors duration-[180ms] ${CHROME.accentHover}`}
        >
          {actionLabel}
        </button>
      )}
      {onExit && (
        <button
          type="button"
          onClick={onExit}
          className={`rounded-[5px] px-1 py-[3px] text-[10.5px] font-medium ${CHROME.mid} transition-colors duration-[180ms] hover:text-white`}
        >
          {exitLabel}
        </button>
      )}
    </div>
  );
}

/** The face switch: two halves, the current one filled; the other half
 *  lands on its face. Shown only when there are at least two faces. */
function FaceSwitch({
  faces,
  current,
  onNavigate,
}: {
  faces: ShellFace[];
  current: string;
  onNavigate: (href: string) => void;
}) {
  if (faces.length < 2) return null;
  return (
    <div className="px-3 pt-3">
      <div role="group" aria-label="Face" className="flex rounded-[9px] border border-white/[.09] bg-white/[.03] p-[3px]">
        {faces.map((f) => {
          const isCurrent = f.id === current;
          return (
            <button
              key={f.id}
              type="button"
              aria-pressed={isCurrent}
              onClick={() => { if (!isCurrent) onNavigate(f.href); }}
              className={`flex-1 rounded-[7px] py-[5px] text-[11.5px] font-semibold transition-colors duration-[180ms] ${
                isCurrent ? `${CHROME.accent} text-white` : `${CHROME.mid} hover:text-white`
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** The nav column with the two gliding bubbles (spec §1.9): the accent bubble
 *  rests on the active item; a faint hover bubble follows the pointer and
 *  fades out in place on leave. */
function SidebarNav({
  nav,
  activeHref,
  onItemClick,
  bubbleKey,
}: {
  nav: ShellNavGroup[];
  activeHref: string | null;
  onItemClick: (item: ShellNavItem, e: React.MouseEvent<HTMLAnchorElement>) => void;
  bubbleKey: string;
}) {
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>());
  const [activeRect, setActiveRect] = useState<{ top: number; h: number } | null>(null);
  const [hoverRect, setHoverRect] = useState<{ top: number; h: number } | null>(null);
  const [hoverVisible, setHoverVisible] = useState(false);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const el = activeHref ? linkRefs.current.get(activeHref) : undefined;
    setActiveRect(el ? { top: el.offsetTop, h: el.offsetHeight } : null);
    const raf = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(raf);
  }, [activeHref, bubbleKey]);

  return (
    <nav
      className="relative flex-1 space-y-2.5 overflow-y-auto px-3 pb-[18px] pt-1.5"
      onMouseLeave={() => setHoverVisible(false)}
    >
      {/* mt-0! on both bubbles: the nav's space-y utility must never push an
          absolutely positioned bubble off its measured spot. */}
      {hoverRect && (
        <div
          aria-hidden
          className={`pointer-events-none absolute left-3 right-3 top-0 z-0 mt-0! rounded-[9px] bg-white/[.05] ${
            hoverVisible ? "opacity-100" : "opacity-0"
          }`}
          style={{
            height: hoverRect.h,
            transform: `translateY(${hoverRect.top}px)`,
            transition: ready ? BUBBLE_TRANSITION : "none",
          }}
        />
      )}
      {activeRect && (
        <div
          aria-hidden
          className={`pointer-events-none absolute left-3 right-3 top-0 z-0 mt-0! rounded-[9px] ${CHROME.accent}`}
          style={{
            height: activeRect.h,
            transform: `translateY(${activeRect.top}px)`,
            boxShadow: CHROME.accentGlow,
            transition: ready ? BUBBLE_TRANSITION : "none",
          }}
        />
      )}
      {nav.filter((g) => g.items.length).map((group, gi) => (
        <div key={group.section ?? `group-${gi}`}>
          {group.section && <p className={SHELL.sectionLabel}>{group.section}</p>}
          <div>
            {group.items.map((item) => {
              const active = item.href === activeHref;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  ref={(node) => {
                    if (node) linkRefs.current.set(item.href, node);
                    else linkRefs.current.delete(item.href);
                  }}
                  onMouseEnter={(e) => {
                    setHoverRect({ top: e.currentTarget.offsetTop, h: e.currentTarget.offsetHeight });
                    setHoverVisible(true);
                  }}
                  onClick={(e) => onItemClick(item, e)}
                  className={`${SHELL.navItem} ${active ? SHELL.navItemActive : SHELL.navItemIdle}`}
                >
                  <Icon {...ICON} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

/** The signed-in user and the sign-out, at the foot of the sidebar. */
function UserStrip({ user, onSignOut }: { user: ShellUser; onSignOut?: () => void }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
      <div className="min-w-0">
        <p className={`truncate text-[11px] font-medium ${CHROME.text}`}>{user.name}</p>
        {user.email && <p className={`truncate text-[10.5px] ${CHROME.dim}`}>{user.email}</p>}
      </div>
      {onSignOut && (
        <button
          type="button"
          onClick={onSignOut}
          className={`shrink-0 rounded-[5px] px-1.5 py-[3px] text-[10.5px] font-medium ${CHROME.mid} transition-colors duration-[180ms] hover:text-white`}
        >
          Sign out
        </button>
      )}
    </div>
  );
}

type SidebarProps = {
  brand: string;
  chip?: string;
  chrome: "consol" | "reporting";
  nav: ShellNavGroup[];
  faces?: ShellFace[];
  faceId?: string;
  activeHref?: string | null;
  onNavigate?: (href: string) => void;
  onJump?: () => void;
  session?: React.ReactNode;
  user?: ShellUser | null;
  onSignOut?: () => void;
  footerHint?: React.ReactNode;
};

function Sidebar({ search, ...p }: SidebarProps & { search: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = React.useMemo(() => p.nav.flatMap((g) => g.items), [p.nav]);
  const activeHref =
    p.activeHref !== undefined
      ? p.activeHref
      : items.find((item) => isNavItemActive(item, items, pathname, search))?.href ?? null;

  const navigate = (href: string) => {
    if (p.onNavigate) p.onNavigate(href);
    else router.push(href);
  };

  const onItemClick = (item: ShellNavItem, e: React.MouseEvent<HTMLAnchorElement>) => {
    if (p.onNavigate) {
      e.preventDefault();
      p.onNavigate(item.href);
      return;
    }
    // Same-pathname, query-only navigation gets swallowed by the soft router;
    // hard-navigate instead.
    if (item.href.split("?")[0] === pathname) {
      e.preventDefault();
      window.location.assign(item.href);
    }
  };

  const openPalette =
    p.onJump ?? (() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true })));

  return (
    <aside
      data-face={p.chrome === "reporting" ? "reporting" : undefined}
      className={`flex w-[224px] flex-shrink-0 flex-col border-r border-white/[.06] ${CHROME.sidebar} print:hidden`}
    >
      {/* Logo row */}
      <div className="flex items-center gap-[9px] border-b border-white/[.06] px-[18px] pb-[18px] pt-[19px]">
        <h1 className="text-base font-bold tracking-[-0.02em] text-white">{p.brand}</h1>
        {p.chip && (
          <span className={`rounded-[7px] ${CHROME.accent} px-[9px] py-[3px] text-xs font-semibold tracking-[-0.01em] text-white`}>
            {p.chip}
          </span>
        )}
      </div>

      {p.faces && <FaceSwitch faces={p.faces} current={p.faceId ?? p.faces[0]?.id ?? ""} onNavigate={navigate} />}

      {/* Jump to launcher */}
      <div className="px-3 pb-1 pt-3">
        <button
          type="button"
          onClick={openPalette}
          className="flex w-full items-center gap-2 rounded-[9px] border border-white/[.09] bg-white/[.03] px-2.5 py-2 transition-colors duration-[180ms] hover:border-white/20 hover:bg-white/[.06]"
        >
          <span aria-hidden className={`h-[11px] w-[11px] rounded-full border-[1.4px] ${CHROME.dimBorder}`} />
          <span className={`flex-1 truncate text-left text-xs ${CHROME.mid}`}>Jump to…</span>
          <span className={`text-[10.5px] font-medium ${CHROME.dim}`}>⌘K</span>
        </button>
      </div>

      <SidebarNav nav={p.nav} activeHref={activeHref} onItemClick={onItemClick} bubbleKey={p.faceId ?? p.chrome} />

      {/* Footer: workspace/session card + product strip */}
      <div className="border-t border-white/[.06] p-3">
        {p.session}
        {p.user && <UserStrip user={p.user} onSignOut={p.onSignOut} />}
        <div className="flex items-center justify-end px-0.5">
          <p className={`text-[10.5px] ${CHROME.dim}`}>{p.footerHint ?? "⌘K to jump"}</p>
        </div>
      </div>
    </aside>
  );
}

/** useSearchParams is reactive to client-side query navigation; it must live
 *  under a Suspense boundary because the shell may wrap prerendered pages. */
function SearchAwareSidebar(props: SidebarProps) {
  const searchParams = useSearchParams();
  return <Sidebar search={searchParams.toString()} {...props} />;
}

export function Shell({
  brand,
  chip,
  chrome = "consol",
  nav,
  faces,
  faceId,
  activeHref,
  onNavigate,
  onJump,
  session,
  user,
  onSignOut,
  footerHint,
  palette,
  className,
  children,
}: {
  /** The product word in the logo row, e.g. "Jetline". */
  brand: string;
  /** The face chip beside it, e.g. "Consol". */
  chip?: string;
  /** Sidebar chrome: Consol's navy and sky, or Reporting's maroon. */
  chrome?: "consol" | "reporting";
  nav: ShellNavGroup[];
  /** Two or more faces show the face switch. */
  faces?: ShellFace[];
  /** The current face's id (defaults to the first face). */
  faceId?: string;
  /** The active item's href; omitted, it is derived from the URL. */
  activeHref?: string | null;
  /** Intercepts nav and face-switch clicks (default: follow the link). */
  onNavigate?: (href: string) => void;
  /** The Jump launcher (default: dispatches Cmd+K for a CommandPalette). */
  onJump?: () => void;
  /** Footer slot above the user, e.g. a ShellSessionCard. */
  session?: React.ReactNode;
  user?: ShellUser | null;
  onSignOut?: () => void;
  /** The footer's right-hand hint (default "⌘K to jump"). */
  footerHint?: React.ReactNode;
  /** Mounts a CommandPalette with these props (Consol's AppShell always did). */
  palette?: React.ComponentProps<typeof CommandPalette>;
  /** The frame; defaults to the full viewport height. */
  className?: string;
  children: React.ReactNode;
}) {
  const sidebar: SidebarProps = {
    brand, chip, chrome, nav, faces, faceId, activeHref, onNavigate, onJump, session, user, onSignOut, footerHint,
  };
  return (
    <ToastProvider>
      <div data-slot="shell" className={cn("flex h-screen bg-[#F7F7F8]", className)}>
        <Suspense fallback={<Sidebar search="" {...sidebar} />}>
          <SearchAwareSidebar {...sidebar} />
        </Suspense>

        <main className="flex flex-1 flex-col overflow-hidden bg-[#F7F7F8] print:overflow-visible">{children}</main>
        {palette && <CommandPalette {...palette} />}
      </div>
    </ToastProvider>
  );
}

