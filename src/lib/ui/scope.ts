/**
 * THE SCOPE GRAMMAR of the Reporting face: one module for the server's
 * resolvers (src/lib/salesData.ts resolveScope / resolveBookScope, the
 * Courier and Photobooks scopes) and the pages' picker (ScopePicker). Pure,
 * no imports, safe on the client.
 *
 * A scope is either ONE whole-set word or a LIST of picks.
 *  - Whole-set words never combine: all (everyone), owned, independents, and a
 *    page's own (Photobooks: collection, delivery, outside).
 *  - Picks combine freely: grp:<group>, div:<division>, ent:<entity id>,
 *    co:<company id>, and a page's own leaf (Courier st:<store>, Photobooks
 *    br:<branch>). Several picks are joined by "~" ("div:JCP Group~ent:12").
 *
 * "~" is unreserved in a URL (never escaped) and a list is split only where a
 * "~" is followed by a pick's prefix, so a name that happens to hold a "~"
 * still reads as one pick. A single pick is the old single-token scope,
 * unchanged, so every saved view recalls exactly as it was saved.
 *
 * The companies of a list are the UNION of its picks' companies (each pick
 * cut to the user's access slice first). The factory rule: Jetline NSC picked
 * EXPLICITLY (its entity, its company, or a group or division that holds only
 * it) always counts; the NSC switch only governs NSC when it comes in through
 * a broader pick.
 */

export const SCOPE_SEP = "~";
export const SCOPE_ALL = "all";

const PICK = /^[a-z]{2,4}:/;
const SPLIT = /~(?=[a-z]{2,4}:)/;

/** A pick (combinable) rather than a whole-set word. */
export const isPick = (token: string) => PICK.test(token);

/** The tokens of a scope string, deduplicated in order. A whole-set word
 * never sits in a list: beside picks it is dropped. Nothing = everyone. */
export function scopeTokens(scope: string | null | undefined): string[] {
  const s = (scope ?? "").trim();
  if (!s) return [SCOPE_ALL];
  return normalise(s.split(SPLIT));
}

function normalise(parts: readonly string[]): string[] {
  const uniq = [...new Set(parts.map((p) => p.trim()).filter(Boolean))];
  const picks = uniq.filter(isPick);
  if (picks.length) return picks;
  return uniq.length ? [uniq[0]] : [SCOPE_ALL];
}

/** The scope string of a list of tokens (the inverse of scopeTokens). */
export function joinScope(tokens: readonly string[]): string {
  return normalise(tokens).join(SCOPE_SEP);
}

/** What one click in the picker does: a whole-set word replaces the list; a
 * pick is added or taken away (the last one taken away leaves everyone). */
export function toggleScope(scope: string, token: string): string {
  if (!isPick(token)) return token;
  const picks = scopeTokens(scope).filter(isPick);
  const next = picks.includes(token) ? picks.filter((t) => t !== token) : [...picks, token];
  return next.length ? joinScope(next) : SCOPE_ALL;
}

/** "A", "A + B", or "A + 3 more" past two. */
export function scopeLabelOf(labels: readonly string[]): string {
  if (labels.length <= 2) return labels.join(" + ");
  return `${labels[0]} + ${labels.length - 1} more`;
}

// ── The resolver ─────────────────────────────────────────────────────────────

export interface ScopeRule<T> {
  match: (item: T) => boolean;
  /** the pick's own name, from the items it matched */
  label: (matched: T[]) => string;
}

export interface FactoryState { inScope: boolean; included: boolean; locked: boolean }

export interface ResolvedScope<T> {
  tokens: string[];
  scoped: T[];
  scopeLabel: string;
  nsc: FactoryState;
}

/**
 * The items a scope covers: the union of its recognised tokens' items, in the
 * order of `all` (already cut to the user's access slice). Unrecognised
 * tokens are ignored; a scope with none recognised is everyone, as before.
 * With a factory test, the factory leaves the scope unless it was picked
 * explicitly (a pick whose items are all factory) or the switch includes it.
 */
export function resolveScopeList<T>(
  all: readonly T[],
  scope: string,
  ruleOf: (token: string) => ScopeRule<T> | null,
  wholeLabel: string,
  factory?: { isFactory: (item: T) => boolean; nsc: "include" | "exclude" },
): ResolvedScope<T> {
  const tokens = scopeTokens(scope);
  const picks = tokens.map((token) => ({ token, rule: ruleOf(token) })).filter((p): p is { token: string; rule: ScopeRule<T> } => !!p.rule);
  let scoped: T[];
  let scopeLabel: string;
  const sets: T[][] = [];
  if (!picks.length) {
    scoped = [...all];
    scopeLabel = wholeLabel;
    sets.push(scoped);
  } else {
    const labels: string[] = [];
    const inScope = new Set<T>();
    for (const p of picks) {
      const matched = all.filter(p.rule.match);
      sets.push(matched);
      labels.push(p.rule.label(matched));
      for (const m of matched) inScope.add(m);
    }
    scoped = all.filter((x) => inScope.has(x));
    scopeLabel = scopeLabelOf(labels);
  }
  let nsc: FactoryState = { inScope: false, included: false, locked: false };
  if (factory) {
    const inScope = scoped.some(factory.isFactory);
    // a pick that IS the factory (and nothing else) always shows it
    const locked = inScope && sets.some((s) => s.length > 0 && s.every(factory.isFactory));
    const included = inScope && (factory.nsc === "include" || locked);
    if (inScope && !included) scoped = scoped.filter((x) => !factory.isFactory(x));
    nsc = { inScope, included, locked };
  }
  return { tokens: picks.length ? picks.map((p) => p.token) : [SCOPE_ALL], scoped, scopeLabel, nsc };
}

/** The keys every reporting item carries for the shared picks. */
export interface ScopeKeys {
  group: string | null;
  division: string | null;
  entityId: string | null;
  entityName: string | null;
  companyId: string | null;
  companyName: string | null;
}

/**
 * The shared picks: all, owned (inside the group structure: it carries a
 * division), independents (outside it), grp:, div:, ent:, co:. A page with a
 * leaf of its own wraps this and answers its own prefix first.
 */
export function standardRule<T>(keys: (item: T) => ScopeKeys, wholeLabel: string): (token: string) => ScopeRule<T> | null {
  return (token) => {
    if (token === SCOPE_ALL) return { match: () => true, label: () => wholeLabel };
    if (token === "owned") return { match: (x) => !!keys(x).division, label: () => "Owned companies" };
    if (token === "independents") return { match: (x) => !keys(x).division, label: () => "Independents" };
    const at = token.indexOf(":");
    if (at < 0) return null;
    const kind = token.slice(0, at), v = token.slice(at + 1);
    if (kind === "grp") return { match: (x) => keys(x).group === v, label: () => v };
    if (kind === "div") return { match: (x) => keys(x).division === v, label: () => v };
    if (kind === "ent") return { match: (x) => keys(x).entityId === v, label: (m) => (m[0] && keys(m[0]).entityName) || "Entity" };
    if (kind === "co") return { match: (x) => keys(x).companyId === v, label: (m) => (m[0] && keys(m[0]).companyName) || "Company" };
    return null;
  };
}
